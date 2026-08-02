import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getISOWeek,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { ISODate, ISOMonth } from './types'

/** Serializa a `YYYY-MM-DD` en hora local (nunca UTC, para no correr el día). */
export function toISO(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

export function fromISO(date: ISODate): Date {
  return parseISO(date)
}

export function todayISO(): ISODate {
  return toISO(new Date())
}

export function monthKey(date: Date): ISOMonth {
  return format(date, 'yyyy-MM')
}

export function monthKeyOf(iso: ISODate): ISOMonth {
  return iso.slice(0, 7)
}

/** Lunes de la semana que contiene `date`. */
export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function weekStartISO(date: Date = new Date()): ISODate {
  return toISO(weekStart(date))
}

/** Los 7 días de la semana de `date`, de lunes a domingo. */
export function weekDays(date: Date = new Date()): Date[] {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function monthDays(date: Date): Date[] {
  return eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) })
}

/** Los últimos `n` días terminando hoy (inclusive), del más viejo al más nuevo. */
export function lastNDays(n: number, from: Date = new Date()): Date[] {
  return Array.from({ length: n }, (_, i) => subDays(from, n - 1 - i))
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(fromISO(b), fromISO(a))
}

export function isFuture(iso: ISODate): boolean {
  return daysBetween(todayISO(), iso) > 0
}

/* ------------------------------------------------------------ Formateo ES */

/** Iniciales de día a la argentina: X para miércoles, S y D para el finde. */
export const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

export function fmt(date: Date | ISODate, pattern: string): string {
  const d = typeof date === 'string' ? fromISO(date) : date
  return format(d, pattern, { locale: es })
}

/** "Martes 4" */
export function weekdayAndDay(date: Date): string {
  return capitalize(fmt(date, 'EEEE d'))
}

/** "Miércoles" */
export function weekdayName(date: Date): string {
  return capitalize(fmt(date, 'EEEE'))
}

/** "julio 2026" -> "Julio 2026" */
export function monthTitle(date: Date): string {
  return capitalize(fmt(date, 'MMMM yyyy'))
}

/** "4 de agosto de 2026" */
export function longDate(date: Date | ISODate): string {
  return fmt(date, "d 'de' MMMM 'de' yyyy")
}

export function weekNumber(date: Date): number {
  return getISOWeek(date)
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** 1.779 — separador de miles a la española. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-AR').format(n)
}
