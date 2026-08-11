import { create } from 'zustand'
import { snapshot, useStore } from '@/lib/store'
import { buildEmpty } from '@/lib/seed'
import type { AppData } from '@/lib/types'
import { loadAll } from './load'
import { pushChanges } from './sync'

/** Estado del guardado, para poder mostrarlo en la interfaz. */
interface SyncStatus {
  state: 'idle' | 'saving' | 'error'
  message: string | null
  setState: (state: SyncStatus['state'], message?: string | null) => void
}

export const useSyncStatus = create<SyncStatus>((set) => ({
  state: 'idle',
  message: null,
  setState: (state, message = null) => set({ state, message }),
}))

/** Cuánto se espera antes de escribir, para agrupar ráfagas de cambios. */
const DEBOUNCE_MS = 500

/**
 * Conecta el store con Supabase: trae todo, hidrata, y desde ahí empuja cada
 * cambio comparando contra lo último confirmado.
 *
 * Devuelve una función para desconectar (al cerrar sesión).
 */
/**
 * Postgres rechaza un token cuyo `iat` esté adelantado respecto de su reloj,
 * aunque sea por un par de segundos. Pasa seguido entre una máquina de
 * escritorio y el servidor, y se arregla solo esperando: el token no cambia,
 * el reloj del servidor avanza.
 */
function isClockSkew(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('issued at future') || message.includes('jwt') && message.includes('future')
}

async function loadWithRetry(userId: string): Promise<AppData> {
  try {
    return await loadAll(userId)
  } catch (cause) {
    if (!isClockSkew(cause)) throw cause
    await new Promise((resolve) => setTimeout(resolve, 2500))
    return loadAll(userId)
  }
}

export async function connectStore(userId: string): Promise<() => void> {
  const loaded = await loadWithRetry(userId)
  useStore.getState().replaceAll(loaded)

  // Referencia de lo que ya está en la base. Todo diff se calcula contra esto.
  let confirmed: AppData = loaded
  let timer: number | null = null
  let inFlight: Promise<void> = Promise.resolve()

  const flush = async () => {
    const next = snapshot(useStore.getState())
    const prev = confirmed
    if (JSON.stringify(prev) === JSON.stringify(next)) return

    // Se marca como confirmado ANTES de esperar: si mientras tanto entra otro
    // cambio, su diff parte de acá y no reenvía lo que ya está en camino.
    confirmed = next
    useSyncStatus.getState().setState('saving')
    try {
      await pushChanges(prev, next, userId)
      useSyncStatus.getState().setState('idle')
    } catch (cause) {
      // Se revierte la marca para que el próximo intento reintente lo perdido.
      confirmed = prev
      useSyncStatus
        .getState()
        .setState('error', cause instanceof Error ? cause.message : 'No se pudo guardar')
    }
  }

  const unsubscribe = useStore.subscribe(() => {
    if (timer !== null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      // Se encadena para que dos ráfagas seguidas no escriban en paralelo y
      // se pisen entre sí.
      inFlight = inFlight.then(flush)
    }, DEBOUNCE_MS)
  })

  // Un cierre de pestaña con cambios sin guardar los perdería.
  const onHide = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
      inFlight = inFlight.then(flush)
    }
  }
  window.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onHide)

  return () => {
    if (timer !== null) window.clearTimeout(timer)
    window.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onHide)
    unsubscribe()
  }
}

/** Deja el store vacío al cerrar sesión, para no filtrar datos entre cuentas. */
export function clearStore() {
  useStore.getState().replaceAll(buildEmpty())
}
