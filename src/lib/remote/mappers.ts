import type {
  Goal,
  GoalCategory,
  Habit,
  JournalRecording,
  LifeArea,
  Pillar,
  Profile,
  Project,
  Quarter,
  RitualEntry,
  SleepNight,
  Task,
  WheelSourceKind,
} from '@/lib/types'

/**
 * Traducción entre el dominio (camelCase, fechas ISO como string) y las filas
 * de Postgres (snake_case). Está todo junto a propósito: cuando cambia el
 * esquema, hay un solo archivo donde mirar.
 */

/* ------------------------------------------------------------------ helpers */

/** `null` de la base -> string vacío del dominio, que nunca usa null en texto. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

type Row = Record<string, unknown>

/* ------------------------------------------------------------------- perfil */

export function rowToProfile(row: Row): Profile {
  return {
    name: text(row.name),
    birthDate: typeof row.birth_date === 'string' ? row.birth_date : '',
    lifeExpectancy: Number(row.life_expectancy ?? 80),
    // La columna no existe en la base: el objetivo de sueño es preferencia de
    // cliente y no vale una migración. Se guarda junto al resto del perfil.
    sleepTargetMinutes: Number(row.sleep_target_minutes ?? 480),
  }
}

export function profileToRow(profile: Profile, userId: string): Row {
  return {
    id: userId,
    name: profile.name,
    birth_date: profile.birthDate === '' ? null : profile.birthDate,
    life_expectancy: profile.lifeExpectancy,
    sleep_target_minutes: profile.sleepTargetMinutes,
  }
}

/* ------------------------------------------------------------------ hábitos */

export function rowToHabit(row: Row): Habit {
  return {
    id: String(row.id),
    name: text(row.name),
    emoji: text(row.emoji),
    colorIndex: Number(row.color_index ?? 0),
    createdAt: String(row.created_at ?? '').slice(0, 10),
    archived: Boolean(row.archived),
    order: Number(row.sort_order ?? 0),
  }
}

export function habitToRow(habit: Habit, userId: string): Row {
  return {
    id: habit.id,
    user_id: userId,
    name: habit.name,
    emoji: habit.emoji,
    color_index: habit.colorIndex,
    archived: habit.archived,
    sort_order: habit.order,
  }
}

/* ------------------------------------------------------- pilares y proyectos */

export function rowToPillar(row: Row): Pillar {
  return {
    id: String(row.id),
    name: text(row.name),
    emoji: text(row.emoji),
    description: text(row.description),
  }
}

export function pillarToRow(pillar: Pillar, userId: string, order: number): Row {
  return {
    id: pillar.id,
    user_id: userId,
    name: pillar.name,
    emoji: pillar.emoji,
    description: pillar.description,
    sort_order: order,
  }
}

export function rowToProject(row: Row): Project {
  return {
    id: String(row.id),
    name: text(row.name),
    emoji: text(row.emoji),
    archived: Boolean(row.archived),
  }
}

export function projectToRow(project: Project, userId: string, order: number): Row {
  return {
    id: project.id,
    user_id: userId,
    name: project.name,
    emoji: project.emoji,
    archived: project.archived,
    sort_order: order,
  }
}

/* ------------------------------------------------------------------ ritual */

export function rowToRitual(row: Row, projectIds: string[]): RitualEntry {
  return {
    date: String(row.day),
    mission: text(row.mission),
    pillarId: row.pillar_id ? String(row.pillar_id) : null,
    sapo: text(row.sapo),
    sapoDone: Boolean(row.sapo_done),
    projectIds,
    energy: Number(row.energy ?? 3),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  }
}

export function ritualToRow(ritual: RitualEntry, userId: string): Row {
  return {
    user_id: userId,
    day: ritual.date,
    mission: ritual.mission,
    pillar_id: ritual.pillarId,
    sapo: ritual.sapo,
    sapo_done: ritual.sapoDone,
    energy: ritual.energy,
    completed_at: ritual.completedAt,
  }
}

/* ------------------------------------------------------------------- tareas */

export function rowToTask(row: Row): Task {
  return {
    id: String(row.id),
    date: String(row.day),
    title: text(row.title),
    note: text(row.note),
    done: Boolean(row.done),
    starred: Boolean(row.starred),
    parentId: row.parent_id ? String(row.parent_id) : null,
    order: Number(row.sort_order ?? 0),
  }
}

export function taskToRow(task: Task, userId: string): Row {
  return {
    id: task.id,
    user_id: userId,
    day: task.date,
    title: task.title,
    note: task.note,
    done: task.done,
    starred: task.starred,
    parent_id: task.parentId,
    sort_order: task.order,
  }
}

/* ------------------------------------------------------------------ premios */

export function rewardToRow(
  weekStart: string,
  description: string,
  claimed: boolean,
  userId: string,
): Row {
  return { user_id: userId, week_start: weekStart, description, claimed }
}

/* ------------------------------------------------------------------ journal */

export function rowToRecording(row: Row): JournalRecording {
  return {
    id: String(row.id),
    createdAt: String(row.recorded_at ?? row.created_at ?? ''),
    durationMs: Number(row.duration_ms ?? 0),
    mimeType: text(row.mime_type),
    size: Number(row.size_bytes ?? 0),
    storagePath: text(row.storage_path) || undefined,
  }
}

export function recordingToRow(
  recording: JournalRecording,
  day: string,
  userId: string,
  storagePath: string,
): Row {
  return {
    id: recording.id,
    user_id: userId,
    day,
    storage_path: storagePath,
    duration_ms: recording.durationMs,
    mime_type: recording.mimeType,
    size_bytes: recording.size,
    recorded_at: recording.createdAt,
  }
}

/* ---------------------------------------------------------------- objetivos */

export function rowToGoalCategory(row: Row): GoalCategory {
  return {
    id: String(row.id),
    label: text(row.label),
    order: Number(row.sort_order ?? 0),
  }
}

export function goalCategoryToRow(category: GoalCategory, userId: string): Row {
  return {
    id: category.id,
    user_id: userId,
    label: category.label,
    sort_order: category.order,
  }
}

export function rowToGoal(row: Row): Goal {
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    title: text(row.title),
    year: Number(row.year),
    quarter: Number(row.quarter) as Quarter,
    done: Boolean(row.done),
    createdAt: String(row.created_at ?? '').slice(0, 10),
  }
}

export function goalToRow(goal: Goal, userId: string): Row {
  return {
    id: goal.id,
    user_id: userId,
    category_id: goal.categoryId,
    title: goal.title,
    year: goal.year,
    quarter: goal.quarter,
    done: goal.done,
  }
}

/* ------------------------------------------------------------ rueda de vida */

export function rowToLifeArea(row: Row): LifeArea {
  const kind = String(row.source_kind ?? 'manual') as WheelSourceKind
  const ids = Array.isArray(row.source_habit_ids) ? row.source_habit_ids.map(String) : []
  return {
    id: String(row.id),
    label: text(row.label),
    order: Number(row.sort_order ?? 0),
    source: { kind, habitIds: ids },
  }
}

export function lifeAreaToRow(area: LifeArea, userId: string): Row {
  return {
    id: area.id,
    user_id: userId,
    label: area.label,
    sort_order: area.order,
    source_kind: area.source.kind,
    // El CHECK de la base exige la lista vacía cuando la fuente no es 'habits'.
    source_habit_ids: area.source.kind === 'habits' ? area.source.habitIds : [],
  }
}

/* -------------------------------------------------------------------- sueño */

export function rowToSleepNight(row: Row): SleepNight {
  const asleep = Number(row.asleep_minutes ?? 0)
  return {
    date: String(row.night),
    bedtime: String(row.bedtime),
    wakeTime: String(row.wake_time),
    asleepMinutes: asleep,
    inBedMinutes: Number(row.in_bed_minutes ?? asleep),
    stages: {
      awake: Number(row.awake_minutes ?? 0),
      rem: Number(row.rem_minutes ?? 0),
      core: Number(row.core_minutes ?? 0),
      deep: Number(row.deep_minutes ?? 0),
      unspecified: Number(row.unspecified_minutes ?? 0),
    },
    source: (row.source as SleepNight['source']) ?? 'manual',
    updatedAt: String(row.updated_at ?? ''),
  }
}

export function sleepNightToRow(night: SleepNight, userId: string): Row {
  return {
    user_id: userId,
    night: night.date,
    bedtime: night.bedtime,
    wake_time: night.wakeTime,
    asleep_minutes: night.asleepMinutes,
    in_bed_minutes: night.inBedMinutes,
    awake_minutes: night.stages.awake,
    rem_minutes: night.stages.rem,
    core_minutes: night.stages.core,
    deep_minutes: night.stages.deep,
    unspecified_minutes: night.stages.unspecified,
    source: night.source,
  }
}
