import { endOfMonth, startOfMonth } from 'date-fns'
import { eachDayOfInterval } from 'date-fns'
import { fromISO, toISO, todayISO } from '@/lib/date'
import type { AppData, ID, ISOMonth, LifeArea, Quarter } from '@/lib/types'

/**
 * Cálculo automático del puntaje de un área para un mes.
 *
 * Nada de esto se guarda: se recalcula cada vez que se mira. Así, corregir un
 * hábito de hace tres meses actualiza la rueda de ese mes sin migraciones ni
 * recálculos manuales.
 *
 * Todas las fuentes devuelven `null` cuando no hay datos suficientes, y la UI
 * cae al valor manual en ese caso. Un área automática sin datos mostrando 0
 * sería mentira: no es que estés mal en salud, es que no hay con qué medirlo.
 */

export interface AutoScore {
  /** 0 a 10 con un decimal. */
  value: number
  /** Qué se usó para calcularlo, para poder explicarlo en pantalla. */
  detail: string
}

/** Días del mes que ya pasaron. No se penaliza por el futuro. */
function elapsedDays(month: ISOMonth): string[] {
  const first = fromISO(`${month}-01`)
  const today = todayISO()
  return eachDayOfInterval({ start: startOfMonth(first), end: endOfMonth(first) })
    .map(toISO)
    .filter((day) => day <= today)
}

function quarterOf(month: ISOMonth): Quarter {
  const m = Number(month.slice(5, 7))
  return (Math.floor((m - 1) / 3) + 1) as Quarter
}

function ratioToScore(ratio: number): number {
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100) / 10
}

function fromHabits(data: AppData, month: ISOMonth, habitIds: ID[]): AutoScore | null {
  const habits = data.habits.filter((h) => habitIds.includes(h.id) && !h.archived)
  if (habits.length === 0) return null

  const days = elapsedDays(month)
  if (days.length === 0) return null

  const dayset = new Set(days)
  let done = 0
  for (const habit of habits) {
    const logged = data.habitLogs[habit.id] ?? []
    done += logged.filter((d) => dayset.has(d)).length
  }
  const total = habits.length * days.length

  return {
    value: ratioToScore(done / total),
    detail: `${done}/${total} marcas en ${habits.map((h) => h.name).join(', ')}`,
  }
}

function fromSleep(data: AppData, month: ISOMonth): AutoScore | null {
  const days = new Set(elapsedDays(month))
  const nights = Object.values(data.sleep).filter((n) => days.has(n.date))
  if (nights.length === 0) return null

  const target = data.profile.sleepTargetMinutes
  const met = nights.filter((n) => n.asleepMinutes >= target).length

  return {
    value: ratioToScore(met / nights.length),
    detail: `${met} de ${nights.length} noches llegaron al objetivo`,
  }
}

function fromTasks(data: AppData, month: ISOMonth): AutoScore | null {
  const days = new Set(elapsedDays(month))
  const tasks = data.tasks.filter((t) => days.has(t.date))
  if (tasks.length === 0) return null

  const done = tasks.filter((t) => t.done).length
  return {
    value: ratioToScore(done / tasks.length),
    detail: `${done}/${tasks.length} tareas completadas`,
  }
}

function fromGoals(data: AppData, month: ISOMonth): AutoScore | null {
  const year = Number(month.slice(0, 4))
  const quarter = quarterOf(month)
  const goals = data.goals.filter((g) => g.year === year && g.quarter === quarter)
  if (goals.length === 0) return null

  const done = goals.filter((g) => g.done).length
  return {
    value: ratioToScore(done / goals.length),
    detail: `${done}/${goals.length} objetivos del T${quarter}`,
  }
}

function fromEnergy(data: AppData, month: ISOMonth): AutoScore | null {
  const days = new Set(elapsedDays(month))
  const rituals = Object.values(data.rituals).filter((r) => days.has(r.date))
  if (rituals.length === 0) return null

  const average = rituals.reduce((acc, r) => acc + r.energy, 0) / rituals.length
  // La energía va de 1 a 5; se estira a 0-10 para no comprimir la escala.
  return {
    value: Math.round(((average - 1) / 4) * 100) / 10,
    detail: `energía promedio ${average.toFixed(1)}/5 en ${rituals.length} días`,
  }
}

export function autoScoreFor(
  area: LifeArea,
  data: AppData,
  month: ISOMonth,
): AutoScore | null {
  switch (area.source.kind) {
    case 'habits':
      return fromHabits(data, month, area.source.habitIds)
    case 'sleep':
      return fromSleep(data, month)
    case 'tasks':
      return fromTasks(data, month)
    case 'goals':
      return fromGoals(data, month)
    case 'energy':
      return fromEnergy(data, month)
    case 'manual':
      return null
  }
}

export const SOURCE_LABELS: Record<import('@/lib/types').WheelSourceKind, string> = {
  manual: 'Lo puntúo yo',
  habits: 'Cumplimiento de hábitos',
  sleep: 'Noches que llegan al objetivo',
  tasks: 'Tareas completadas',
  goals: 'Objetivos del trimestre',
  energy: 'Energía del ritual',
}
