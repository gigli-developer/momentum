import { subDays } from 'date-fns'
import { fromISO, lastNDays, monthKeyOf, toISO, todayISO, weekDays } from './date'
import type { AppData, Habit, ID, ISODate, SleepNight } from './types'

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

/* --------------------------------------------------------------------- Sueño */

export interface SleepSummary {
  nights: number
  /** Promedio de minutos dormidos. */
  averageAsleep: number
  averageInBed: number
  /** Eficiencia: dormido / en cama, en porcentaje. */
  efficiency: number
  /** Minutos por debajo del objetivo, acumulados. 0 si no hay deuda. */
  debtMinutes: number
  /** Promedio de cada fase, en minutos. */
  stages: { awake: number; rem: number; core: number; deep: number }
  /**
   * Desvío estándar de la hora de acostarse, en minutos. Cuanto más bajo, más
   * regular sos. Es el indicador que más correlaciona con dormir bien.
   */
  bedtimeConsistency: number
  /** Hora promedio de acostarse, en minutos desde medianoche (puede ser > 24h). */
  averageBedtime: number
}

/** Minutos desde la medianoche ANTERIOR; 1:30 AM devuelve 1530, no 90. */
function bedtimeOffset(night: SleepNight): number {
  const bed = new Date(night.bedtime)
  const minutes = bed.getHours() * 60 + bed.getMinutes()
  // Acostarse después de medianoche pertenece a la noche anterior.
  return minutes < 12 * 60 ? minutes + 24 * 60 : minutes
}

export function sleepSummary(
  sleep: Record<ISODate, SleepNight>,
  targetMinutes: number,
  window = 7,
): SleepSummary {
  const days = new Set(lastNDays(window).map(toISO))
  const nights = Object.values(sleep).filter((n) => days.has(n.date))

  const empty: SleepSummary = {
    nights: 0,
    averageAsleep: 0,
    averageInBed: 0,
    efficiency: 0,
    debtMinutes: 0,
    stages: { awake: 0, rem: 0, core: 0, deep: 0 },
    bedtimeConsistency: 0,
    averageBedtime: 0,
  }
  if (nights.length === 0) return empty

  const n = nights.length
  const sum = (fn: (night: SleepNight) => number) => nights.reduce((acc, x) => acc + fn(x), 0)
  const averageAsleep = Math.round(sum((x) => x.asleepMinutes) / n)
  const averageInBed = Math.round(sum((x) => x.inBedMinutes) / n)

  const offsets = nights.map(bedtimeOffset)
  const averageBedtime = offsets.reduce((a, b) => a + b, 0) / n
  const variance = offsets.reduce((acc, o) => acc + (o - averageBedtime) ** 2, 0) / n

  return {
    nights: n,
    averageAsleep,
    averageInBed,
    efficiency: averageInBed === 0 ? 0 : Math.round((averageAsleep / averageInBed) * 100),
    debtMinutes: Math.max(0, sum((x) => Math.max(0, targetMinutes - x.asleepMinutes))),
    stages: {
      awake: Math.round(sum((x) => x.stages.awake) / n),
      rem: Math.round(sum((x) => x.stages.rem) / n),
      core: Math.round(sum((x) => x.stages.core) / n),
      deep: Math.round(sum((x) => x.stages.deep) / n),
    },
    bedtimeConsistency: Math.round(Math.sqrt(variance)),
    averageBedtime: Math.round(averageBedtime),
  }
}

export interface SleepEnergyPoint {
  date: ISODate
  asleepMinutes: number
  energy: number
}

/**
 * Cruza cuánto dormiste con el nivel de energía que cargaste esa mañana en el
 * ritual. Es el único cruce de la app entre dos módulos distintos.
 */
export function sleepVsEnergy(data: AppData): SleepEnergyPoint[] {
  return Object.values(data.sleep)
    .map((night) => {
      const ritual = data.rituals[night.date]
      if (!ritual) return null
      return { date: night.date, asleepMinutes: night.asleepMinutes, energy: ritual.energy }
    })
    .filter((point): point is SleepEnergyPoint => point !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Coeficiente de Pearson, o `null` si no hay datos suficientes o no hay varianza. */
export function correlation(points: Array<[number, number]>): number | null {
  const n = points.length
  if (n < 4) return null
  const meanX = points.reduce((a, [x]) => a + x, 0) / n
  const meanY = points.reduce((a, [, y]) => a + y, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (const [x, y] of points) {
    num += (x - meanX) * (y - meanY)
    dx += (x - meanX) ** 2
    dy += (y - meanY) ** 2
  }
  if (dx === 0 || dy === 0) return null
  return num / Math.sqrt(dx * dy)
}

/** `7h 32m` */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, '0')}m`
}

/** Minutos desde medianoche a `23:45`, tolerando valores por encima de 24 h. */
export function formatClock(minutesFromMidnight: number): string {
  const total = ((minutesFromMidnight % 1440) + 1440) % 1440
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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

  const journalDays = closedJournalDays(data).length
  if (journalDays > 0) {
    out.push({
      id: 'journal',
      emoji: '📓',
      label: `${journalDays} ${journalDays === 1 ? 'día' : 'días'} de journal`,
    })
  }

  return out.slice(0, 3)
}
