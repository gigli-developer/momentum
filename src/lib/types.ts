/** Modelo de dominio de Momentum. Nada acá depende de React ni del storage. */

export type ID = string
/** Fecha en formato `YYYY-MM-DD` (siempre en hora local del usuario). */
export type ISODate = string
/** Mes en formato `YYYY-MM`. */
export type ISOMonth = string


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
  /** Línea secundaria opcional, debajo del título. */
  note: string
  done: boolean
  /** Marcada como importante. */
  starred: boolean
  /** Tarea padre. Un solo nivel de anidamiento: una subtarea no tiene hijas. */
  parentId: ID | null
  order: number
}

export interface WeekReward {
  /** Lunes de la semana, en ISODate. */
  weekStart: ISODate
  text: string
  claimed: boolean
}

/* -------------------------------------------------------------- Objetivos
   Las secciones las define el usuario. Arranca con Personal y Profesional,
   pero puede crear las que quiera (Salud, Finanzas, Estudio…). */

export interface GoalCategory {
  id: ID
  label: string
  order: number
}

/** Siempre tiene que quedar al menos una sección donde colgar objetivos. */
export const MIN_GOAL_CATEGORIES = 1

export type Quarter = 1 | 2 | 3 | 4

export interface Goal {
  id: ID
  categoryId: ID
  title: string
  year: number
  quarter: Quarter
  done: boolean
  createdAt: ISODate
}

/* -------------------------------------------------------- Rueda de la vida */

/**
 * Las áreas las define el usuario: puede agregar, renombrar y eliminar.
 * El radar se dibuja con tantos ejes como áreas haya.
 */
/**
 * De dónde sale el puntaje de un área.
 *
 * `manual` es el default y guarda el número que movés con el slider. El resto
 * se calcula al vuelo desde los otros módulos: no se guarda nada derivado, así
 * que si corregís un hábito de hace tres meses, la rueda de ese mes se
 * recalcula sola.
 */
export type WheelSourceKind =
  | 'manual'
  /** Cumplimiento promedio de los hábitos elegidos, en el mes. */
  | 'habits'
  /** Porcentaje de noches que llegaron al objetivo de sueño. */
  | 'sleep'
  /** Porcentaje de tareas completadas del mes. */
  | 'tasks'
  /** Porcentaje de objetivos cumplidos del trimestre. */
  | 'goals'
  /** Promedio del nivel de energía cargado en el ritual matutino. */
  | 'energy'

export interface WheelSource {
  kind: WheelSourceKind
  /** Sólo para `habits`: qué hábitos alimentan esta área. */
  habitIds: ID[]
}

export interface LifeArea {
  id: ID
  label: string
  order: number
  source: WheelSource
}

/** Menos de 3 ejes no forman un polígono; más de 10 no se lee. */
export const MIN_LIFE_AREAS = 3
export const MAX_LIFE_AREAS = 10

/** `areaId -> puntaje 0-10`. */
export type WheelScores = Record<ID, number>

export interface WheelEntry {
  month: ISOMonth
  scores: WheelScores
}

/* ---------------------------------------------------------------- Journal
   El journal se sigue escribiendo a mano. Acá queda el audio de leerlo, más
   el registro de qué tareas del día se cumplieron. El blob del audio vive en
   IndexedDB (ver lib/media.ts); esto son sólo los metadatos. */

export interface JournalRecording {
  id: ID
  /** Timestamp ISO en que se terminó de grabar. */
  createdAt: string
  durationMs: number
  mimeType: string
  /** Bytes, para poder mostrar cuánto ocupa el journal sin abrir cada blob. */
  size: number
}

export interface JournalEntry {
  date: ISODate
  recordings: JournalRecording[]
  /** Cuándo se dio el día por cerrado. `null` = todavía abierto. */
  closedAt: string | null
}

/* ------------------------------------------------------------------ Sueño
   Los datos vienen del Apple Watch. Una app web no puede leer HealthKit, así
   que entran por el Atajo de iOS (diario) o por el export XML de Salud
   (histórico). También se pueden cargar a mano. */

export type SleepSource = 'shortcut' | 'import' | 'manual'

export interface SleepStages {
  /** Minutos despierto durante la noche. No cuentan como dormido. */
  awake: number
  rem: number
  /** "Core" en Apple Health; el sueño ligero. */
  core: number
  deep: number
  /** Minutos dormidos sin fase identificada (registros viejos o de iPhone). */
  unspecified: number
}

export interface SleepNight {
  /**
   * Fecha de la MAÑANA en que te despertaste: una noche pertenece al día que
   * amanece, si no las noches que cruzan medianoche se parten en dos.
   */
  date: ISODate
  /** Timestamps ISO. */
  bedtime: string
  wakeTime: string
  /** Minutos efectivamente dormidos (no incluye `stages.awake`). */
  asleepMinutes: number
  /** Minutos entre acostarse y levantarse. */
  inBedMinutes: number
  stages: SleepStages
  source: SleepSource
  updatedAt: string
}

/* -------------------------------------------------------------- Memento */

export interface Profile {
  name: string
  /** Necesaria para Memento Mori. Vacía = módulo en estado de configuración. */
  birthDate: ISODate | ''
  /** Expectativa de vida en años. */
  lifeExpectancy: number
  /** Objetivo de sueño en minutos. Por defecto 8 h. */
  sleepTargetMinutes: number
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
  journal: Record<ISODate, JournalEntry>
  goalCategories: GoalCategory[]
  goals: Goal[]
  lifeAreas: LifeArea[]
  wheel: Record<ISOMonth, WheelEntry>
  sleep: Record<ISODate, SleepNight>
}
