import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ISODate } from '@/lib/types'

export interface CalendarEvent {
  id: string
  summary: string
  /** ISO datetime, o `YYYY-MM-DD` si es de día completo. */
  start: string
  end: string
  allDay: boolean
  location: string | null
  link: string | null
}

/** `no_conectado` es un estado esperable, no un error: se muestra distinto. */
export type CalendarState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'disconnected' }
  | { status: 'error'; message: string }
  | { status: 'ready'; byDay: Map<ISODate, CalendarEvent[]> }

async function callCalendar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    method: 'POST',
    body,
  })
  // `invoke` marca error ante cualquier status >= 400, incluido el 409 de
  // "no conectado", así que hay que mirar el cuerpo para distinguirlos.
  if (error) {
    const detail = (data as { error?: string } | null)?.error
    throw new Error(detail ?? error.message)
  }
  return data as Record<string, unknown>
}

/** A qué día pertenece un evento, en hora local. */
function dayOf(event: CalendarEvent): ISODate {
  if (event.allDay) return event.start.slice(0, 10)
  const date = new Date(event.start)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Trae los eventos de un rango y los agrupa por día.
 *
 * No se cachean en Supabase: un calendario cambia todo el tiempo y una copia
 * local estaría desactualizada más seguido que al día.
 */
export function useCalendarEvents(from: ISODate, to: ISODate, enabled = true): {
  state: CalendarState
  reload: () => void
} {
  const [state, setState] = useState<CalendarState>({ status: 'idle' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })

    callCalendar({ action: 'list', from, to })
      .then((payload) => {
        if (cancelled) return
        const events = (payload.events ?? []) as CalendarEvent[]
        const byDay = new Map<ISODate, CalendarEvent[]>()
        for (const event of events) {
          const day = dayOf(event)
          const list = byDay.get(day)
          if (list) list.push(event)
          else byDay.set(day, [event])
        }
        setState({ status: 'ready', byDay })
      })
      .catch((cause: Error) => {
        if (cancelled) return
        if (cause.message === 'no_conectado') setState({ status: 'disconnected' })
        else setState({ status: 'error', message: cause.message })
      })

    return () => {
      cancelled = true
    }
  }, [from, to, enabled, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { state, reload }
}

export interface CreateEventInput {
  summary: string
  note?: string
  /** ISO datetime con offset. */
  start: string
  end: string
}

export async function createCalendarEvent(input: CreateEventInput) {
  const payload = await callCalendar({ action: 'create', ...input })
  return payload.event as { id: string; link: string | null }
}

/** `14:30` a partir de un ISO datetime, en hora local. */
export function eventTime(event: CalendarEvent): string {
  if (event.allDay) return 'Todo el día'
  const date = new Date(event.start)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
