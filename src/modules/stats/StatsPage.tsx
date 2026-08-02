import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BarChart3, Flame, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/Progress'
import { catColor } from '@/lib/cn'
import { evolution, focusMinutesThisMonth, habitStats, weeklyHabitProgress } from '@/lib/stats'
import { snapshot, useStore } from '@/lib/store'

export function StatsPage() {
  // useShallow: `snapshot` arma un objeto nuevo en cada llamada y sin esto
  // zustand re-renderiza en loop.
  const data = useStore(useShallow(snapshot))

  const stats = useMemo(() => habitStats(data.habits, data.habitLogs, 30), [data])
  const weekly = useMemo(
    () => weeklyHabitProgress(data.habits, data.habitLogs),
    [data],
  )
  const rows = useMemo(() => evolution(data), [data])

  const bestStreaks = useMemo(
    () => [...stats].sort((a, b) => b.streak - a.streak).slice(0, 5),
    [stats],
  )
  const bestHabits = useMemo(() => [...stats].sort((a, b) => b.rate - a.rate).slice(0, 5), [stats])

  const focusMinutes = focusMinutesThisMonth(data)

  if (data.habits.length === 0) {
    return (
      <>
        <PageHeader
          icon={<BarChart3 className="size-5" />}
          title="Estadísticas y rachas"
          description="Visualizá tu progreso, rachas y mejores hábitos."
        />
        <EmptyState
          title="Todavía no hay nada que medir"
          description="Cargá tus primeros hábitos y en una semana esta pantalla te va a decir bastante."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon={<BarChart3 className="size-5" />}
        title="Estadísticas y rachas"
        description="Visualizá tu progreso, rachas y mejores hábitos."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* ------------------------------------------------- Resumen semanal */}
        <Card>
          <SectionTitle>Resumen semanal</SectionTitle>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {weekly.pct}
            <span className="text-lg font-normal text-ink-faint">%</span>
          </p>
          <p className="text-sm text-ink-muted">
            {weekly.done}/{weekly.total} casillas marcadas esta semana
          </p>
          <ProgressBar className="mt-3" value={weekly.pct} />

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Panel>
              <SectionTitle>Enfoque del mes</SectionTitle>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {Math.floor(focusMinutes / 60)}h {focusMinutes % 60}m
              </p>
            </Panel>
            <Panel>
              <SectionTitle>Hábitos activos</SectionTitle>
              <p className="mt-1 text-xl font-semibold tabular-nums">{data.habits.length}</p>
            </Panel>
          </div>
        </Card>

        {/* ---------------------------------------------- Las mejores rachas */}
        <Card>
          <SectionTitle>Las mejores rachas</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2">
            {bestStreaks.map((s, i) => (
              <li key={s.habit.id} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-right text-xs text-ink-faint tabular-nums">{i + 1}.</span>
                <span aria-hidden>{s.habit.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{s.habit.name}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-xs font-medium text-accent tabular-nums">
                  <Flame className="size-3" />
                  {s.streak}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            La racha sobrevive si marcás antes de que termine el día siguiente.
          </p>
        </Card>

        {/* --------------------------------------------- Los mejores hábitos */}
        <Card>
          <SectionTitle>Los mejores hábitos</SectionTitle>
          <p className="mt-1 text-xs text-ink-faint">Cumplimiento en los últimos 30 días.</p>
          <ul className="mt-3 flex flex-col gap-3">
            {bestHabits.map((s, i) => (
              <li key={s.habit.id}>
                <div className="mb-1 flex items-center gap-3 text-sm">
                  <span className="w-4 text-right text-xs text-ink-faint tabular-nums">
                    {i + 1}.
                  </span>
                  <span aria-hidden>{s.habit.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{s.habit.name}</span>
                  <span className="text-xs font-medium text-ink-muted tabular-nums">
                    {s.rate}%
                  </span>
                </div>
                <ProgressBar
                  className="ml-7"
                  value={s.rate}
                  color={catColor(s.habit.colorIndex)}
                  size={4}
                />
              </li>
            ))}
          </ul>
        </Card>

        {/* ------------------------------------------------ Evolución reciente */}
        <Card>
          <SectionTitle>Evolución reciente</SectionTitle>
          <p className="mt-1 text-xs text-ink-faint">
            Últimos 7 días contra los 7 anteriores.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {rows.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink-muted">{row.label}</span>
                <span className="font-semibold tabular-nums">{row.value}</span>
                <span
                  className={
                    row.delta > 0
                      ? 'inline-flex w-12 items-center justify-end gap-0.5 text-xs text-positive tabular-nums'
                      : row.delta < 0
                        ? 'inline-flex w-12 items-center justify-end gap-0.5 text-xs text-negative tabular-nums'
                        : 'inline-flex w-12 items-center justify-end gap-0.5 text-xs text-ink-faint'
                  }
                >
                  {row.delta > 0 ? (
                    <TrendingUp className="size-3" />
                  ) : row.delta < 0 ? (
                    <TrendingDown className="size-3" />
                  ) : (
                    <Minus className="size-3" />
                  )}
                  {row.delta === 0 ? '' : Math.abs(row.delta)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
