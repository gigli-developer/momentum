import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { ArrowUpRight, Flame } from 'lucide-react'
import { IconTile } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Progress'
import { catColor, cn } from '@/lib/cn'
import {
  capitalize,
  fmt,
  formatNumber,
  lastNDays,
  monthKey,
  toISO,
  todayISO,
  weekStartISO,
} from '@/lib/date'
import { habitStats, lifeProgress, weeklyHabitProgress } from '@/lib/stats'
import { snapshot, useStore } from '@/lib/store'
import { GRID_MODULES } from '@/modules/registry'
import { LIFE_AREAS } from '@/lib/types'
import { RadarChart } from '@/modules/wheel/RadarChart'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Todavía de noche'
  if (hour < 13) return 'Buen día'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function PreviewShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mt-4 rounded-card border border-line bg-surface-2 p-3.5', className)}>
      {children}
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-ink-faint">{children}</p>
}

export function DashboardPage() {
  const data = useStore(useShallow(snapshot))
  const today = todayISO()

  const stats = useMemo(() => habitStats(data.habits, data.habitLogs), [data])
  const weekly = useMemo(() => weeklyHabitProgress(data.habits, data.habitLogs), [data])
  const life = useMemo(
    () => lifeProgress(data.profile.birthDate, data.profile.lifeExpectancy),
    [data.profile],
  )

  const ritual = data.rituals[today]
  const pillar = data.pillars.find((p) => p.id === ritual?.pillarId)
  const todayTasks = data.tasks.filter((t) => t.date === today)
  const year = new Date().getFullYear()
  const yearGoals = data.goals.filter((g) => g.year === year)
  const goalsDone = yearGoals.filter((g) => g.done).length
  const wheelScores = data.wheel[monthKey(new Date())]?.scores
  const wheelAverage = wheelScores
    ? LIFE_AREAS.reduce((acc, a) => acc + (wheelScores[a.id] ?? 0), 0) / LIFE_AREAS.length
    : null
  const topStreaks = [...stats].sort((a, b) => b.streak - a.streak).slice(0, 3)
  const dreamsPending = data.dreams.filter((d) => !d.achieved)
  const reward = data.rewards[weekStartISO()]

  const previews: Record<string, React.ReactNode> = {
    /* ------------------------------------------------------------ Hábitos */
    habitos: (
      <PreviewShell>
        {data.habits.length === 0 ? (
          <Muted>Sin hábitos todavía.</Muted>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              {data.habits.slice(0, 4).map((habit) => {
                const logged = new Set(data.habitLogs[habit.id] ?? [])
                return (
                  <div key={habit.id} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 truncate text-[11px] text-ink-muted">
                      {habit.emoji} {habit.name}
                    </span>
                    <div className="flex flex-1 gap-1">
                      {lastNDays(12).map((day) => {
                        const on = logged.has(toISO(day))
                        return (
                          <span
                            key={toISO(day)}
                            className="h-3.5 flex-1 rounded-[3px]"
                            style={{
                              backgroundColor: on
                                ? catColor(habit.colorIndex)
                                : 'var(--color-surface-3)',
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              <span className="font-semibold text-ink">{weekly.pct}%</span> esta semana
            </p>
          </>
        )}
      </PreviewShell>
    ),

    /* ------------------------------------------------------------- Ritual */
    ritual: (
      <PreviewShell className="bg-transparent p-0">
        <div className="rounded-card bg-accent p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-ink/70">
            Misión de hoy
          </p>
          <p className="mt-1 truncate text-base font-semibold text-accent-ink">
            {ritual?.mission ? `“${ritual.mission}”` : 'Todavía sin definir'}
          </p>
        </div>
        <div className="mt-2 rounded-card border border-line bg-surface-2 p-3.5">
          <Muted>Pilar de hoy</Muted>
          <p className="mt-0.5 text-sm text-ink">
            {pillar ? `${pillar.emoji} ${pillar.name}` : 'Sin pilar elegido'}
          </p>
          <div className="mt-2.5 flex gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  i < (ritual?.energy ?? 0) ? 'bg-accent' : 'bg-surface-3',
                )}
              />
            ))}
          </div>
        </div>
      </PreviewShell>
    ),

    /* --------------------------------------------------------- Semana */
    semana: (
      <PreviewShell>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink">{capitalize(fmt(new Date(), 'EEEE d'))}</p>
          <span className="text-xs text-ink-faint tabular-nums">
            {todayTasks.filter((t) => t.done).length}/{todayTasks.length}
          </span>
        </div>
        {todayTasks.length === 0 ? (
          <Muted>Sin tareas para hoy.</Muted>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {todayTasks.slice(0, 4).map((task) => (
              <li key={task.id} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    'size-3 shrink-0 rounded-[4px] border',
                    task.done ? 'border-transparent bg-accent' : 'border-line-strong',
                  )}
                />
                <span className={cn('truncate', task.done ? 'text-ink-faint line-through' : 'text-ink-muted')}>
                  {task.title}
                </span>
              </li>
            ))}
          </ul>
        )}
        {reward?.text ? (
          <p className="mt-3 truncate text-xs text-accent">🎁 {reward.text}</p>
        ) : null}
      </PreviewShell>
    ),

    /* ------------------------------------------------------------ Objetivos */
    objetivos: (
      <PreviewShell>
        <div className="flex items-baseline justify-between">
          <Muted>Año {year}</Muted>
          <span className="text-xs text-ink-faint tabular-nums">
            {goalsDone}/{yearGoals.length}
          </span>
        </div>
        <ProgressBar
          className="mt-2"
          value={yearGoals.length === 0 ? 0 : (goalsDone / yearGoals.length) * 100}
        />
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((q) => {
            const qGoals = yearGoals.filter((g) => g.quarter === q)
            const qDone = qGoals.filter((g) => g.done).length
            return (
              <div key={q} className="rounded-tile bg-surface-3 px-2 py-1.5 text-center">
                <p className="text-[10px] text-ink-faint">T{q}</p>
                <p className="text-xs font-semibold tabular-nums">
                  {qDone}/{qGoals.length}
                </p>
              </div>
            )
          })}
        </div>
      </PreviewShell>
    ),

    /* ---------------------------------------------------------------- Rueda */
    rueda: (
      <PreviewShell className="flex items-center gap-3">
        <div className="w-28 shrink-0">
          {wheelScores ? (
            <RadarChart
              series={[
                {
                  id: 'mini',
                  label: 'Este mes',
                  scores: wheelScores,
                  color: 'var(--color-accent)',
                  fillOpacity: 0.2,
                },
              ]}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <Muted>Promedio del mes</Muted>
          <p className="text-2xl font-semibold tabular-nums">
            {wheelAverage === null ? '—' : wheelAverage.toFixed(1)}
            <span className="text-sm font-normal text-ink-faint">/10</span>
          </p>
        </div>
      </PreviewShell>
    ),

    /* -------------------------------------------------------- Estadísticas */
    estadisticas: (
      <PreviewShell>
        <div className="flex items-baseline justify-between">
          <Muted>Progreso semanal</Muted>
          <span className="text-sm font-semibold tabular-nums">{weekly.pct}%</span>
        </div>
        <ProgressBar className="mt-2" value={weekly.pct} />
        <ul className="mt-3 flex flex-col gap-1">
          {topStreaks.map((s) => (
            <li key={s.habit.id} className="flex items-center gap-2 text-xs">
              <span aria-hidden>{s.habit.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-ink-muted">{s.habit.name}</span>
              <span className="inline-flex items-center gap-0.5 text-accent tabular-nums">
                <Flame className="size-3" />
                {s.streak}
              </span>
            </li>
          ))}
        </ul>
      </PreviewShell>
    ),

    /* -------------------------------------------------------------- Memento */
    memento: (
      <PreviewShell>
        {life ? (
          <>
            <p className="text-sm text-ink">
              Llevás vividas{' '}
              <strong className="font-semibold">{formatNumber(life.weeksLived)}</strong> de{' '}
              {formatNumber(life.weeksTotal)} semanas.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={life.pct} className="flex-1" />
              <span className="text-sm font-semibold tabular-nums">{life.pct}%</span>
            </div>
          </>
        ) : (
          <Muted>Cargá tu fecha de nacimiento para activarlo.</Muted>
        )}
      </PreviewShell>
    ),

    /* -------------------------------------------------------------- Enfoque */
    enfoque: (
      <PreviewShell className="flex items-center justify-between">
        <div>
          <Muted>Bloque de enfoque</Muted>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {String(data.focusSettings.focus).padStart(2, '0')}:00
          </p>
        </div>
        <div className="text-right">
          <Muted>Bloques hoy</Muted>
          <p className="text-xl font-semibold tabular-nums">
            {data.focusSessions.filter((s) => s.finishedAt.slice(0, 10) === today).length}
          </p>
        </div>
      </PreviewShell>
    ),

    /* --------------------------------------------------------------- Sueños */
    suenos: (
      <PreviewShell>
        {dreamsPending.length === 0 ? (
          <Muted>Sin sueños pendientes.</Muted>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {dreamsPending.slice(0, 3).map((dream) => (
              <li key={dream.id} className="flex items-center gap-2 text-xs">
                <span aria-hidden>⭐</span>
                <span className="min-w-0 flex-1 truncate text-ink-muted">{dream.title}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-faint">
          {data.dreams.filter((d) => d.achieved).length}/{data.dreams.length} cumplidos
        </p>
      </PreviewShell>
    ),
  }

  return (
    <>
      <header className="mb-7">
        <p className="text-sm text-ink-muted">
          {capitalize(fmt(new Date(), "EEEE d 'de' MMMM"))}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          {greeting()}
          {data.profile.name ? `, ${data.profile.name}` : ''}.
        </h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GRID_MODULES.map(({ id, path, title, description, Icon }) => (
          <Link
            key={id}
            to={path}
            className="group flex flex-col rounded-panel border border-line bg-surface p-5 transition-colors hover:border-accent/40"
          >
            <div className="flex items-start gap-3.5">
              <IconTile>
                <Icon className="size-5" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-1 text-base font-semibold tracking-tight">
                  {title}
                  <ArrowUpRight className="size-4 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                </h2>
                <p className="mt-0.5 text-sm leading-snug text-ink-muted">{description}</p>
              </div>
            </div>
            <div className="mt-auto">{previews[id]}</div>
          </Link>
        ))}
      </div>
    </>
  )
}
