import { subDays } from 'date-fns'
import { fromISO, lastNDays, monthKeyOf, toISO, todayISO, weekDays } from './date'
import type { AppData, Habit, ID, ISODate } from './types'

/* ------------------------------------------------------------------ Rachas */

/**
 * Racha vigente. Si hoy todavía no marcaste, la racha sigue viva mientras
 * ayer esté marcado — así no "perdés" la racha por consultar a la mañana.
 */
export function currentStreak(days: ISODate[], today: ISODate = todayISO()): number {
  if (days.length === 0) return 0
  const set = new Set(days)
  // fromISO y no `new Date(today)`: `new Date('2026-08-03')` es medianoche UTC,
  // que al formatear en local cae un día antes en cualquier huso al oeste de
  // Greenwich. La racha arrancaba desde ayer e ignoraba lo marcado hoy.
  let cursor = fromISO(today)
  if (!set.has(toISO(cursor))) {
    cursor = subDays(cursor, 1)
    if (!set.has(toISO(cursor))) return 0
  }
  let streak = 0
  while (set.has(toISO(cursor))) {
    streak++
    cursor = subDays(cursor, 1)
  }
  return streak
}

export function bestStreak(days: ISODate[]): number {
  if (days.length === 0) return 0
  const sorted = [...days].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = fromISO(sorted[i - 1])
    const cur = fromISO(sorted[i])
    const gap = Math.round((cur.getTime() - prev.getTime()) / 86_400_000)
    run = gap === 1 ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

/** Porcentaje de cumplimiento en los últimos `window` días (0-100). */
export function completionRate(days: ISODate[], window = 30): number {
  const set = new Set(days)
  const hits = lastNDays(window).filter((d) => set.has(toISO(d))).length
  return Math.round((hits / window) * 100)
}

/* ----------------------------------------------------------------- Agregados */

export interface HabitStat {
  habit: Habit
  streak: number
  best: number
  rate: number
  totalDays: number
}

export function habitStats(
  habits: Habit[],
  logs: Record<ID, ISODate[]>,
  window = 30,
): HabitStat[] {
  return habits.map((habit) => {
    const days = logs[habit.id] ?? []
    return {
      habit,
      streak: currentStreak(days),
      best: bestStreak(days),
      rate: completionRate(days, window),
      totalDays: days.length,
    }
  })
}

export interface WeeklyProgress {
  done: number
  total: number
  pct: number
}

/** Cuántas casillas de hábito se marcaron esta semana sobre el total posible. */
export function weeklyHabitProgress(
  habits: Habit[],
  logs: Record<ID, ISODate[]>,
  reference = new Date(),
): WeeklyProgress {
  const days = weekDays(reference).map(toISO)
  const today = todayISO()
  // Sólo contamos días que ya pasaron: no penalizamos por el futuro.
  const elapsed = days.filter((d) => d <= today)
  const total = habits.length * elapsed.length
  let done = 0
  for (const habit of habits) {
    const set = new Set(logs[habit.id] ?? [])
    done += elapsed.filter((d) => set.has(d)).length
  }
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/* ----------------------------------------------------------------- Evolución */

export interface EvolutionRow {
  label: string
  value: number
  delta: number
}

/**
 * Compara los últimos 7 días contra los 7 anteriores.
 * `delta` positivo = mejoraste respecto de la semana pasada.
 */
export function evolution(data: AppData): EvolutionRow[] {
  const today = new Date()
  const thisWeek = new Set(lastNDays(7, today).map(toISO))
  const prevWeek = new Set(lastNDays(7, subDays(today, 7)).map(toISO))

  const ritualsIn = (range: Set<string>) =>
    Object.values(data.rituals).filter((r) => r.completedAt !== null && range.has(r.date)).length

  const habitMarksIn = (range: Set<string>) =>
    Object.values(data.habitLogs).reduce(
      (acc, days) => acc + days.filter((d) => range.has(d)).length,
      0,
    )

  const tasksDoneIn = (range: Set<string>) =>
    data.tasks.filter((t) => t.done && range.has(t.date)).length

  const journalIn = (range: Set<string>) =>
    Object.values(data.journal).filter((e) => e.closedAt !== null && range.has(e.date)).length

  return [
    {
      label: 'Rituales completados',
      value: ritualsIn(thisWeek),
      delta: ritualsIn(thisWeek) - ritualsIn(prevWeek),
    },
    {
      label: 'Hábitos marcados',
      value: habitMarksIn(thisWeek),
      delta: habitMarksIn(thisWeek) - habitMarksIn(prevWeek),
    },
    {
      label: 'Tareas completadas',
      value: tasksDoneIn(thisWeek),
      delta: tasksDoneIn(thisWeek) - tasksDoneIn(prevWeek),
    },
    {
      label: 'Días de journal',
      value: journalIn(thisWeek),
      delta: journalIn(thisWeek) - journalIn(prevWeek),
    },
    {
      label: 'Objetivos cumplidos (total)',
      value: data.goals.filter((g) => g.done).length,
      delta: 0,
    },
  ]
}

/* -------------------------------------------------------------- Memento Mori */

/** Semanas por fila en la grilla de vida; también define el total. */
export const WEEKS_PER_YEAR = 52

export interface LifeProgress {
  weeksLived: number
  weeksTotal: number
  pct: number
  yearsLived: number
}

export function lifeProgress(birthDate: ISODate, lifeExpectancy: number): LifeProgress | null {
  if (!birthDate) return null
  const born = new Date(birthDate)
  if (Number.isNaN(born.getTime())) return null
  const msLived = Date.now() - born.getTime()
  if (msLived < 0) return null
  const weeksLived = Math.floor(msLived / (7 * 86_400_000))
  // 52 exactas (no 52,18) para que el número coincida con la grilla de puntos.
  const weeksTotal = lifeExpectancy * WEEKS_PER_YEAR
  return {
    weeksLived,
    weeksTotal,
    pct: Math.min(100, Math.round((weeksLived / weeksTotal) * 100)),
    yearsLived: Math.floor(msLived / (365.25 * 86_400_000)),
  }
}

/* ------------------------------------------------------------------- Journal */

/** Días con el journal cerrado, del más viejo al más nuevo. */
export function closedJournalDays(data: AppData): ISODate[] {
  return Object.values(data.journal)
    .filter((entry) => entry.closedAt !== null)
    .map((entry) => entry.date)
    .sort()
}

/** Racha de días cerrados seguidos, con la misma tolerancia que los hábitos. */
export function journalStreak(data: AppData): number {
  return currentStreak(closedJournalDays(data))
}

export function journalRecordingCount(data: AppData): number {
  return Object.values(data.journal).reduce((acc, entry) => acc + entry.recordings.length, 0)
}

/** Bytes que ocupan todas las grabaciones, según los metadatos. */
export function journalAudioBytes(data: AppData): number {
  return Object.values(data.journal).reduce(
    (acc, entry) => acc + entry.recordings.reduce((sum, r) => sum + r.size, 0),
    0,
  )
}

/* ------------------------------------------------------------------ Rituales */

export function ritualsCompletedThisMonth(data: AppData): number {
  const month = monthKeyOf(todayISO())
  return Object.values(data.rituals).filter(
    (r) => r.completedAt !== null && monthKeyOf(r.date) === month,
  ).length
}

/* ------------------------------------------------------------------- Logros */

export interface Achievement {
  id: string
  emoji: string
  label: string
}

/** Hitos recientes que se muestran en el ritual matutino. */
export function recentAchievements(data: AppData): Achievement[] {
  const out: Achievement[] = []
  const stats = habitStats(data.habits, data.habitLogs)

  const ritualsDone = Object.values(data.rituals).filter((r) => r.completedAt).length
  if (ritualsDone >= 1) {
    out.push({ id: 'first-ritual', emoji: '🏆', label: 'Primer ritual completado' })
  }

  const topStreak = stats.reduce((max, s) => (s.streak > max.streak ? s : max), stats[0])
  if (topStreak && topStreak.streak >= 3) {
    out.push({
      id: 'streak',
      emoji: '🔥',
      label: `Racha de ${topStreak.streak} días en ${topStreak.habit.name}`,
    })
  }

  const goalsDone = data.goals.filter((g) => g.done).length
  if (goalsDone > 0) {
    out.push({ id: 'goals', emoji: '🎯', label: `${goalsDone} objetivos cumplidos` })
  }

  const dreamsDone = data.dreams.filter((d) => d.achieved).length
  if (dreamsDone > 0) {
    out.push({ id: 'dreams', emoji: '⭐', label: `${dreamsDone} sueños cumplidos` })
  }

  return out.slice(0, 3)
}
