import { useMemo, useState } from 'react'
import { addWeeks, isSameWeek, subWeeks } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Gift } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DayTaskList } from '@/components/tasks/DayTaskList'
import { DayEvents } from '@/components/calendar/DayEvents'
import { useCalendarEvents } from '@/lib/google/calendar'
import { cn } from '@/lib/cn'
import {
  WEEKDAY_INITIALS,
  capitalize,
  fmt,
  toISO,
  todayISO,
  weekDays,
  weekStartISO,
} from '@/lib/date'
import { useStore } from '@/lib/store'

export function PlannerPage() {
  const [cursor, setCursor] = useState(() => new Date())

  const tasks = useStore((s) => s.tasks)
  const rewards = useStore((s) => s.rewards)
  const setReward = useStore((s) => s.setReward)
  const claimReward = useStore((s) => s.claimReward)

  const days = useMemo(() => weekDays(cursor), [cursor])
  const { state: calendar } = useCalendarEvents(toISO(days[0]), toISO(days[6]))
  const start = weekStartISO(cursor)
  const reward = rewards[start] ?? { weekStart: start, text: '', claimed: false }
  const today = todayISO()
  const isThisWeek = isSameWeek(cursor, new Date(), { weekStartsOn: 1 })

  const weekTotals = useMemo(() => {
    const iso = new Set(days.map(toISO))
    const all = tasks.filter((t) => iso.has(t.date))
    return { done: all.filter((t) => t.done).length, total: all.length }
  }, [tasks, days])

  function scrollToDay(iso: string) {
    document.getElementById(`day-${iso}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }

  return (
    <>
      <PageHeader
        icon={<CalendarDays className="size-5" />}
        title="Planificador semanal"
        description="Organizá tu semana, tus tareas y tu enfoque."
        action={
          <div className="flex items-center gap-1">
            <IconButton label="Semana anterior" onClick={() => setCursor((c) => subWeeks(c, 1))}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="min-w-28 text-center text-sm text-ink-muted">
              {isThisWeek ? 'Esta semana' : `${fmt(days[0], 'd MMM')} – ${fmt(days[6], 'd MMM')}`}
            </span>
            <IconButton label="Semana siguiente" onClick={() => setCursor((c) => addWeeks(c, 1))}>
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        }
      />

      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex gap-1.5">
          {days.map((day, i) => {
            const iso = toISO(day)
            return (
              <button
                key={iso}
                type="button"
                onClick={() => scrollToDay(iso)}
                aria-label={`Ir a ${capitalize(fmt(day, "EEEE d 'de' MMMM"))}`}
                className={cn(
                  'grid size-8 place-items-center rounded-full text-xs font-medium transition-colors',
                  iso === today
                    ? 'bg-accent text-accent-ink'
                    : 'border border-line text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                {WEEKDAY_INITIALS[i]}
              </button>
            )
          })}
        </div>
        <span className="text-sm text-ink-muted tabular-nums">
          {weekTotals.done}/{weekTotals.total} tareas
        </span>
      </div>

      {/* Columnas por día, con scroll horizontal como un tablero. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-8 md:px-8">
        <div className="flex min-w-max gap-3">
          {days.map((day) => {
            const iso = toISO(day)
            const isToday = iso === today

            return (
              <section
                key={iso}
                id={`day-${iso}`}
                className={cn(
                  'flex w-[280px] shrink-0 flex-col rounded-panel border bg-surface p-3',
                  isToday ? 'border-accent/45' : 'border-line',
                )}
              >
                <header className="mb-2 flex items-baseline justify-between gap-2 px-1.5">
                  <h2
                    className={cn(
                      'text-sm font-semibold',
                      isToday ? 'text-accent' : 'text-ink',
                    )}
                  >
                    {capitalize(fmt(day, 'EEEE'))}
                  </h2>
                  <span className="text-xs text-ink-faint tabular-nums">{fmt(day, 'd MMM')}</span>
                </header>

                <DayEvents date={iso} state={calendar} />
                <DayTaskList date={iso} />
              </section>
            )
          })}

          {/* --------------------------------------------------- El premio */}
          <section className="flex w-[280px] shrink-0 flex-col rounded-panel border border-dashed border-accent/45 bg-accent/[0.04] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Gift className="size-4 text-accent" />
              <SectionTitle className="text-accent">Tu premio</SectionTitle>
            </div>
            <p className="mb-3 text-sm text-ink-muted">
              Si cerrás la semana, ¿con qué te vas a premiar?
            </p>
            <Input
              value={reward.text}
              onChange={(e) => setReward(start, e.target.value)}
              placeholder="Ej: un asado con amigos"
            />
            <Button
              className="mt-3 w-full"
              variant={reward.claimed ? 'secondary' : 'primary'}
              disabled={!reward.text.trim()}
              onClick={() => claimReward(start)}
            >
              {reward.claimed ? 'Premio cobrado ✓' : 'Marcar como cobrado'}
            </Button>
          </section>
        </div>
      </div>

      <Card className="mt-4 p-4">
        <p className="text-xs text-ink-muted">
          Tocá el texto de una tarea para editarla o agregarle un detalle. Con el ícono de flecha
          sumás una subtarea, y con la estrella la marcás como importante. Completar una tarea
          completa también sus subtareas.
        </p>
      </Card>
    </>
  )
}
