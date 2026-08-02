import { useMemo, useState } from 'react'
import { addWeeks, isSameWeek, subWeeks } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Gift, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input, InlineAdd } from '@/components/ui/Input'
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
  const [selected, setSelected] = useState(() => todayISO())

  const tasks = useStore((s) => s.tasks)
  const addTask = useStore((s) => s.addTask)
  const toggleTask = useStore((s) => s.toggleTask)
  const removeTask = useStore((s) => s.removeTask)
  const rewards = useStore((s) => s.rewards)
  const setReward = useStore((s) => s.setReward)
  const claimReward = useStore((s) => s.claimReward)

  const days = useMemo(() => weekDays(cursor), [cursor])
  const start = weekStartISO(cursor)
  const reward = rewards[start] ?? { weekStart: start, text: '', claimed: false }
  const today = todayISO()
  const isThisWeek = isSameWeek(cursor, new Date(), { weekStartsOn: 1 })

  const byDay = useMemo(() => {
    const map = new Map<string, typeof tasks>()
    for (const day of days) map.set(toISO(day), [])
    for (const task of tasks) {
      const bucket = map.get(task.date)
      if (bucket) bucket.push(task)
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.order - b.order)
    return map
  }, [tasks, days])

  const weekTotals = useMemo(() => {
    const all = days.flatMap((d) => byDay.get(toISO(d)) ?? [])
    return { done: all.filter((t) => t.done).length, total: all.length }
  }, [days, byDay])

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

      {/* Selector de día: L M X J V S D */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex gap-1.5">
          {days.map((day, i) => {
            const iso = toISO(day)
            const isToday = iso === today
            const isSelected = iso === selected
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                aria-label={capitalize(fmt(day, "EEEE d 'de' MMMM"))}
                aria-pressed={isSelected}
                className={cn(
                  'grid size-8 place-items-center rounded-full text-xs font-medium transition-colors',
                  isSelected
                    ? 'bg-accent text-accent-ink'
                    : isToday
                      ? 'border border-accent/60 text-accent'
                      : 'border border-line text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                {WEEKDAY_INITIALS[i]}
              </button>
            )
          })}
        </div>
        <span className="text-sm text-ink-muted">
          {weekTotals.done}/{weekTotals.total} tareas
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => {
          const iso = toISO(day)
          const dayTasks = byDay.get(iso) ?? []
          const done = dayTasks.filter((t) => t.done).length
          const isSelected = iso === selected

          return (
            <Card
              key={iso}
              className={cn(
                'flex flex-col p-4 transition-colors',
                isSelected && 'border-accent/50',
              )}
            >
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className={cn('text-sm font-semibold', iso === today && 'text-accent')}>
                  {capitalize(fmt(day, 'EEEE d'))}
                </h2>
                <span className="text-xs text-ink-faint">
                  {dayTasks.length === 0 ? 'Sin tareas' : `${done}/${dayTasks.length}`}
                </span>
              </div>

              {dayTasks.length === 0 ? (
                <p className="mb-3 text-sm text-ink-faint">Sin tareas todavía.</p>
              ) : (
                <ul className="mb-3 flex flex-col gap-1">
                  {dayTasks.map((task) => (
                    <li key={task.id} className="group flex items-center gap-2">
                      <Checkbox
                        className="min-w-0 flex-1"
                        checked={task.done}
                        onChange={() => toggleTask(task.id)}
                        label={task.title}
                      />
                      <IconButton
                        label={`Eliminar ${task.title}`}
                        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => removeTask(task.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}

              <InlineAdd
                className="mt-auto"
                placeholder="Nueva tarea"
                onAdd={(title) => addTask(iso, title)}
              />
            </Card>
          )
        })}

        {/* ------------------------------------------------------- El premio */}
        <Card className="flex flex-col border-dashed border-accent/45 bg-accent/[0.04] p-4">
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
        </Card>
      </div>
    </>
  )
}
