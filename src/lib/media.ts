/**
 * Guardado de archivos pesados (hoy: audio del journal).
 *
 * Los blobs no pueden ir a localStorage: hay ~5 MB de tope y base64 los infla
 * un 33%. Van a IndexedDB, y en el store de zustand quedan sólo los metadatos.
 * Este archivo es el único que toca IndexedDB.
 */

const DB_NAME = 'momentum-media'
const STORE = 'blobs'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador'))
      return
    }
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'))
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Error de IndexedDB'))
      }),
  )
}

export function putBlob(id: string, blob: Blob): Promise<IDBValidKey> {
  return tx('readwrite', (store) => store.put(blob, id))
}

export async function getBlob(id: string): Promise<Blob | null> {
  const result = await tx<Blob | undefined>('readonly', (store) => store.get(id))
  return result ?? null
}

export function deleteBlob(id: string): Promise<undefined> {
  return tx('readwrite', (store) => store.delete(id))
}

export function clearBlobs(): Promise<undefined> {
  return tx('readwrite', (store) => store.clear())
}

/** Ids que realmente existen en disco, para detectar metadatos huérfanos. */
export async function listBlobIds(): Promise<string[]> {
  const keys = await tx<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
  return keys.map(String)
}

export interface StorageUsage {
  usage: number
  quota: number
}

/** Cuánto espacio está usando el navegador. `null` si la API no existe. */
export async function estimateUsage(): Promise<StorageUsage | null> {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** `3:07` — para duraciones de audio. */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
