/** Modelo de dominio de Momentum. Nada acá depende de React ni del storage. */

export type ID = string
/** Fecha en formato `YYYY-MM-DD` (siempre en hora local del usuario). */
export type ISODate = string
/** Mes en formato `YYYY-MM`. */
export type ISOMonth = string

export type Scope = 'personal' | 'professional'

/* ---------------------------------------------------------------- Hábitos */

export interface Habit {
  id: ID
  name: string
  emoji: string
  /** Índice 0-7 dentro de la paleta categórica de tokens. */
  colorIndex: number
  createdAt: ISODate
  archived: boolean
  order: number
}

/** `habitId -> lista de días marcados`. Se guarda como array para serializar. */
export type HabitLogs = Record<ID, ISODate[]>

/* --------------------------------------------------------- Ritual matutino */

export interface Pillar {
  id: ID
  name: string
  emoji: string
  /** El "para qué" del pilar, se muestra debajo del nombre en el ritual. */
  description: string
}

export interface Project {
  id: ID
  name: string
  emoji: string
  archived: boolean
}

export interface RitualEntry {
  date: ISODate
  /** La misión del día: una sola frase. */
  mission: string
  pillarId: ID | null
  /** El SAPO: la tarea que más estás evitando. */
  sapo: string
  sapoDone: boolean
  projectIds: ID[]
  /** 1 a 5. */
  energy: number
  /** Timestamp ISO cuando se completó el ritual, o null. */
  completedAt: string | null
}

/* ---------------------------------------------------- Planificador semanal */

export interface Task {
  id: ID
  date: ISODate
  title: string
  done: boolean
  order: number
}

export interface WeekReward {
  /** Lunes de la semana, en ISODate. */
  weekStart: ISODate
  text: string
  claimed: boolean
}

/* ------------------------------------------------- Sueños y objetivos
   Un SUEÑO es un destino sin fecha. Un OBJETIVO es un compromiso con año y
   trimestre que te acerca a un sueño. Por eso `Goal.dreamId` — es lo que
   evita que ambos módulos sean la misma lista con distinto nombre. */

export interface Dream {
  id: ID
  scope: Scope
  title: string
  achieved: boolean
  createdAt: ISODate
}

export type Quarter = 1 | 2 | 3 | 4

export interface Goal {
  id: ID
  scope: Scope
  /** Sueño del que cuelga este objetivo. `null` = objetivo suelto. */
  dreamId: ID | null
  title: string
  year: number
  quarter: Quarter
  done: boolean
  createdAt: ISODate
}

/* -------------------------------------------------------- Rueda de la vida */

export const LIFE_AREAS = [
  { id: 'salud', label: 'Salud y deporte' },
  { id: 'familia', label: 'Familia y amor' },
  { id: 'trabajo', label: 'Trabajo y finanzas' },
  { id: 'ocio', label: 'Ocio y amistad' },
  { id: 'tiempo', label: 'Tiempo para mí' },
  { id: 'emocional', label: 'Emocional' },
  { id: 'educativa', label: 'Educativa y cultural' },
  { id: 'espiritual', label: 'Espiritual y ética' },
] as const

export type LifeAreaId = (typeof LIFE_AREAS)[number]['id']

export type WheelScores = Record<LifeAreaId, number>

export interface WheelEntry {
  month: ISOMonth
  /** Cada área de 0 a 10. */
  scores: WheelScores
}

/* ------------------------------------------------ Temporizador de enfoque */

export type FocusMode = 'focus' | 'short' | 'long'

export interface FocusSettings {
  focus: number
  short: number
  long: number
  /** Cada cuántos bloques de enfoque toca el descanso largo. */
  longEvery: number
}

export interface FocusSession {
  id: ID
  /** Timestamp ISO en que terminó el bloque. */
  finishedAt: string
  minutes: number
  label: string
}

/* -------------------------------------------------------------- Memento */

export interface Profile {
  name: string
  /** Necesaria para Memento Mori. Vacía = módulo en estado de configuración. */
  birthDate: ISODate | ''
  /** Expectativa de vida en años. */
  lifeExpectancy: number
}

/* ---------------------------------------------------------- Estado global */

export interface AppData {
  profile: Profile
  habits: Habit[]
  habitLogs: HabitLogs
  pillars: Pillar[]
  projects: Project[]
  rituals: Record<ISODate, RitualEntry>
  tasks: Task[]
  rewards: Record<ISODate, WeekReward>
  dreams: Dream[]
  goals: Goal[]
  wheel: Record<ISOMonth, WheelEntry>
  focusSettings: FocusSettings
  focusSessions: FocusSession[]
}
