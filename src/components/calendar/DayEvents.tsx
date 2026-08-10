import { CalendarClock, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/cn'
import { eventTime, type CalendarEvent, type CalendarState } from '@/lib/google/calendar'
import type { ISODate } from '@/lib/types'

interface DayEventsProps {
  date: ISODate
  state: CalendarState
  /** `compact` para las columnas del planificador; `full` para el journal. */
  variant?: 'compact' | 'full'
}

/**
 * Eventos del calendario de un día, arriba de las tareas.
 *
 * Se dibujan con borde punteado y sin checkbox para que no se confundan con
 * tareas: un evento no se completa, ocurre.
 */
export function DayEvents({ date, state, variant = 'compact' }: DayEventsProps) {
  // Cuando no hay cuenta conectada el módulo desaparece sin ruido: no tiene
  // sentido mostrar un error donde el usuario no pidió nada.
  if (state.status !== 'ready') return null

  const events = state.byDay.get(date) ?? []
  if (events.length === 0) return null

  return (
    <ul className={cn('mb-2 flex flex-col gap-1', variant === 'full' && 'gap-1.5')}>
      {events.map((event) => (
        <EventRow key={event.id} event={event} variant={variant} />
      ))}
    </ul>
  )
}

function EventRow({
  event,
  variant,
}: {
  event: CalendarEvent
  variant: 'compact' | 'full'
}) {
  const content = (
    <>
      <CalendarClock className="mt-0.5 size-3 shrink-0 text-ink-faint" />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-ink-muted',
            variant === 'full' ? 'text-sm' : 'text-xs',
          )}
        >
          {event.summary}
        </span>
        <span className="block text-[10px] tabular-nums text-ink-faint">
          {eventTime(event)}
          {event.location ? ` · ${event.location}` : ''}
        </span>
      </span>
      {event.link ? (
        <ExternalLink className="mt-0.5 size-3 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover/event:opacity-100" />
      ) : null}
    </>
  )

  const className = cn(
    'group/event flex items-start gap-2 rounded-tile border border-dashed border-line px-2 py-1.5',
    'transition-colors hover:border-line-strong',
  )

  return (
    <li>
      {event.link ? (
        <a href={event.link} target="_blank" rel="noreferrer" className={className}>
          {content}
        </a>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  )
}
