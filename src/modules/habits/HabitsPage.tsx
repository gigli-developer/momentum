import { useMemo, useState } from 'react'
import { addMonths, isSameMonth, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, CircleCheckBig, Flame, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/Button'
import { InlineAdd } from '@/components/ui/Input'
import { ProgressBar } from '@/components/ui/Progress'
import { catColor, cn } from '@/lib/cn'
import { fmt, isFuture, monthDays, monthTitle, toISO, todayISO, weekNumber } from '@/lib/date'
import { currentStreak } from '@/lib/stats'
import { useStore } from '@/lib/store'

const EMOJI_POOL = ['🔥', '💧', '📖', '🏃', '🧘', '🌱', '🎧', '✍️', '🥗', '☀️', '💤', '💪']

export function HabitsPage() {
  const [cursor, setCursor] = useState(() => new Date())
  const habits = useStore((s) => s.habits)
  const habitLogs = useStore((s) => s.habitLogs)
  const toggleHabitDay = useStore((s) => s.toggleHabitDay)
  const addHabit = useStore((s) => s.addHabit)
  const removeHabit = useStore((s) => s.removeHabit)

  const days = useMemo(() => monthDays(cursor), [cursor])
  const today = todayISO()

  // Agrupamos por semana ISO para los encabezados "Semana 1, 2, 3…".
  const weekGroups = useMemo(() => {
    const groups: Array<{ week: number; count: number }> = []
    for (const day of days) {
      const week = weekNumber(day)
      const last = groups[groups.length - 1]
      if (last && last.week === week) last.count++
      else groups.push({ week, count: 1 })
    }
    return groups
  }, [days])

  const monthStats = useMemo(() => {
    const monthISO = days.filter((d) => !isFuture(toISO(d))).map(toISO)
    const total = habits.length * monthISO.length
    let done = 0
    for (const habit of habits) {
      const set = new Set(habitLogs[habit.id] ?? [])
      done += monthISO.filter((d) => set.has(d)).length
    }
    return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
  }, [days, habits, habitLogs])

  const showingCurrentMonth = isSameMonth(cursor, new Date())

  return (
    <>
      <PageHeader
        icon={<CircleCheckBig className="size-5" />}
        title="Panel de hábitos"
        description="Construí hábitos sólidos y seguí tu progreso día a día."
      />

      <Card className="overflow-hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <IconButton label="Mes anterior" onClick={() => setCursor((c) => subMonths(c, 1))}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="min-w-36 text-center text-sm font-medium">{monthTitle(cursor)}</span>
            <IconButton
              label="Mes siguiente"
              disabled={showingCurrentMonth}
              onClick={() => setCursor((c) => addMonths(c, 1))}
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-muted">
              {monthStats.done}/{monthStats.total} ·{' '}
              <span className="font-semibold text-ink">{monthStats.pct}%</span>
            </span>
            <ProgressBar value={monthStats.pct} className="w-24" />
          </div>
        </div>

        {habits.length === 0 ? (
          <EmptyState
            title="Todavía no tenés hábitos"
            description="Empezá con uno solo. El que sostengas dos semanas seguidas te va a decir mucho más que una lista de diez."
          />
        ) : (
          <div className="-mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface pb-2 text-left" />
                  {weekGroups.map((group, i) => (
                    <th
                      key={group.week}
                      colSpan={group.count}
                      className={cn(
                        'pb-2 text-[10px] font-semibold uppercase tracking-[0.12em]',
                        i % 2 === 0 ? 'text-accent' : 'text-ink-faint',
                      )}
                    >
                      Semana {i + 1}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface pb-2 pr-4 text-left">
                    <SectionTitle>Hábito</SectionTitle>
                  </th>
                  {days.map((day) => {
                    const iso = toISO(day)
                    const isToday = iso === today
                    return (
                      <th key={iso} className="px-0.5 pb-2">
                        <div
                          className={cn(
                            'mx-auto flex w-7 flex-col items-center rounded-[6px] py-0.5',
                            isToday && 'bg-accent/15',
                          )}
                        >
                          <span
                            className={cn(
                              'text-[9px] uppercase',
                              isToday ? 'text-accent' : 'text-ink-faint',
                            )}
                          >
                            {fmt(day, 'EEEEE')}
                          </span>
                          <span
                            className={cn(
                              'text-[11px] tabular-nums',
                              isToday ? 'font-semibold text-accent' : 'text-ink-muted',
                            )}
                          >
                            {fmt(day, 'd')}
                          </span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {habits.map((habit) => {
                  const logged = new Set(habitLogs[habit.id] ?? [])
                  const streak = currentStreak(habitLogs[habit.id] ?? [])
                  return (
                    <tr key={habit.id} className="group/row">
                      <th className="sticky left-0 z-10 bg-surface py-1 pr-4 text-left font-normal">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: catColor(habit.colorIndex) }}
                          />
                          <span aria-hidden>{habit.emoji}</span>
                          <span className="text-ink">{habit.name}</span>
                          {streak >= 2 ? (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-accent">
                              <Flame className="size-3" />
                              {streak}
                            </span>
                          ) : null}
                          <IconButton
                            label={`Eliminar ${habit.name}`}
                            className="ml-1 opacity-0 transition-opacity group-hover/row:opacity-100"
                            onClick={() => removeHabit(habit.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        </div>
                      </th>

                      {days.map((day) => {
                        const iso = toISO(day)
                        const future = isFuture(iso)
                        return (
                          <td key={iso} className="px-0.5 py-1">
                            <div className="flex justify-center">
                              <Checkbox
                                hideLabel
                                disabled={future}
                                checked={logged.has(iso)}
                                color={catColor(habit.colorIndex)}
                                onChange={() => toggleHabitDay(habit.id, iso)}
                                label={`${habit.name} · ${fmt(day, 'd MMMM')}`}
                              />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Panel className="mt-5">
          <SectionTitle className="mb-2">Nuevo hábito</SectionTitle>
          <InlineAdd
            placeholder="Ej: Caminar 30 minutos"
            onAdd={(name) =>
              addHabit({ name, emoji: EMOJI_POOL[habits.length % EMOJI_POOL.length] })
            }
          />
        </Panel>
      </Card>
    </>
  )
}
