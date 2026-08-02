import type { StateStorage } from 'zustand/middleware'

/**
 * Único punto de contacto con la persistencia.
 *
 * Hoy es localStorage. Para migrar a Supabase (o IndexedDB) alcanza con
 * reimplementar `getItem/setItem/removeItem` acá: ni el store ni los
 * componentes saben de dónde salen los datos.
 */
export const STORAGE_KEY = 'momentum:v1'

const memoryFallback = new Map<string, string>()

function available(): boolean {
  try {
    const probe = '__momentum_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

const hasLocalStorage = typeof window !== 'undefined' && available()

export const appStorage: StateStorage = {
  getItem: (name) =>
    hasLocalStorage ? window.localStorage.getItem(name) : (memoryFallback.get(name) ?? null),
  setItem: (name, value) => {
    if (hasLocalStorage) window.localStorage.setItem(name, value)
    else memoryFallback.set(name, value)
  },
  removeItem: (name) => {
    if (hasLocalStorage) window.localStorage.removeItem(name)
    else memoryFallback.delete(name)
  },
}

/** Descarga un backup del estado completo. */
export function downloadBackup(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
