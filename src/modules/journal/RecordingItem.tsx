import { useEffect, useState } from 'react'
import { Download, Mic, Trash2, TriangleAlert } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { formatBytes, formatDuration, getBlob } from '@/lib/media'
import { signedUrlFor } from '@/lib/remote/audio'
import { fmt } from '@/lib/date'
import type { JournalRecording } from '@/lib/types'

interface RecordingItemProps {
  recording: JournalRecording
  date: string
  index: number
  onDelete: () => void
}

export function RecordingItem({ recording, date, index, onDelete }: RecordingItemProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    // Con `storagePath` el audio vive en Supabase y se reproduce con una URL
    // firmada; sin él es una grabación del modo local, en IndexedDB.
    const load = recording.storagePath
      ? signedUrlFor(recording.storagePath).then((signed) => {
          if (!cancelled) setUrl(signed)
        })
      : getBlob(recording.id).then((blob) => {
          if (cancelled) return
          if (!blob) {
            setMissing(true)
            return
          }
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        })

    load.catch(() => {
      if (!cancelled) setMissing(true)
    })

    return () => {
      cancelled = true
      // Sin esto el blob queda retenido en memoria mientras viva la pestaña.
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [recording.id, recording.storagePath])

  function download() {
    if (!url) return
    const extension = recording.mimeType.includes('mp4') ? 'm4a' : 'webm'
    const a = document.createElement('a')
    a.href = url
    a.download = `journal-${date}-${index + 1}.${extension}`
    a.click()
  }

  return (
    <li className="rounded-card border border-line bg-surface-2 p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-tile bg-accent/12 text-accent">
          <Mic className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            Lectura {index + 1} · {formatDuration(recording.durationMs)}
          </p>
          <p className="text-xs text-ink-faint">
            {fmt(new Date(recording.createdAt), 'HH:mm')} · {formatBytes(recording.size)}
          </p>
        </div>

        <IconButton label="Descargar audio" disabled={!url} onClick={download}>
          <Download className="size-4" />
        </IconButton>
        <IconButton label="Eliminar grabación" onClick={onDelete}>
          <Trash2 className="size-4" />
        </IconButton>
      </div>

      {missing ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-negative">
          <TriangleAlert className="size-3.5 shrink-0" />
          {recording.storagePath
            ? 'No pude traer el audio del servidor.'
            : 'El audio no está en este navegador.'}
        </p>
      ) : url ? (
        <audio controls src={url} className="mt-3 h-9 w-full" preload="metadata" />
      ) : (
        <p className="mt-3 text-xs text-ink-faint">Cargando audio…</p>
      )}
    </li>
  )
}
