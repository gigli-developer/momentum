import { supabase } from '@/lib/supabase'
import type { ISODate, JournalRecording } from '@/lib/types'

/**
 * Audio del journal en Supabase Storage.
 *
 * A diferencia del resto del estado, las grabaciones NO pasan por el
 * sincronizador por diferencias: subir un archivo es una operación explícita,
 * lenta y que puede fallar sola. Merece su propio camino, con su propio error.
 *
 * Convención de rutas: `{user_id}/{YYYY-MM-DD}/{recording_id}.{ext}`, que es
 * sobre lo que se apoyan las políticas del bucket.
 */

const BUCKET = 'journal-audio'

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mpeg')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

export function storagePathFor(
  userId: string,
  date: ISODate,
  id: string,
  mimeType: string,
): string {
  return `${userId}/${date}/${id}.${extensionFor(mimeType)}`
}

/**
 * Sube el audio y deja la fila de metadatos.
 *
 * El orden importa: primero el archivo, después la fila. Al revés quedaría un
 * metadato apuntando a un audio que no existe, que es el estado que la app no
 * sabe mostrar.
 */
export async function uploadRecording(
  userId: string,
  date: ISODate,
  recording: JournalRecording,
  blob: Blob,
): Promise<string> {
  const path = storagePathFor(userId, date, recording.id, recording.mimeType)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: recording.mimeType, upsert: true })

  if (uploadError) throw new Error(`No pude subir el audio: ${uploadError.message}`)

  // La fila de journal_recordings tiene una foreign key contra journal_entries,
  // así que el día tiene que existir antes. No se puede esperar al
  // sincronizador: está debounceado y llegaría tarde.
  const { error: entryError } = await supabase
    .from('journal_entries')
    .upsert({ user_id: userId, day: date }, { onConflict: 'user_id,day' })

  if (entryError) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`No pude preparar el día: ${entryError.message}`)
  }

  const { error: rowError } = await supabase.from('journal_recordings').insert({
    id: recording.id,
    user_id: userId,
    day: date,
    storage_path: path,
    duration_ms: recording.durationMs,
    mime_type: recording.mimeType,
    size_bytes: recording.size,
    recorded_at: recording.createdAt,
  })

  if (rowError) {
    // Si la fila falla, se limpia el archivo: un audio sin metadato es
    // invisible desde la app y ocupa cuota para siempre.
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`No pude guardar la grabación: ${rowError.message}`)
  }

  return path
}

/** URL firmada de corta duración. El bucket es privado: no hay URL pública. */
export async function signedUrlFor(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'No pude generar el enlace del audio')
  }
  return data.signedUrl
}

/**
 * Borra la grabación de las dos capas.
 *
 * Primero la fila y después el archivo: si se cortara en el medio, queda un
 * archivo huérfano —que el trigger `journal_recordings_track_orphans` deja
 * anotado en `orphaned_audio`— y no un metadato roto.
 */
export async function deleteRecording(recordingId: string, path: string): Promise<void> {
  const { error: rowError } = await supabase
    .from('journal_recordings')
    .delete()
    .eq('id', recordingId)

  if (rowError) throw new Error(`No pude borrar la grabación: ${rowError.message}`)

  const { error: fileError } = await supabase.storage.from(BUCKET).remove([path])
  if (fileError) {
    // No se corta: la fila ya no está y el archivo quedó registrado como
    // huérfano, que es recuperable. Fallar acá sólo confundiría.
    console.warn('El archivo quedó huérfano en Storage:', fileError.message)
  } else {
    await supabase.from('orphaned_audio').delete().eq('storage_path', path)
  }
}
