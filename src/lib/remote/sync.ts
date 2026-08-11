import { supabase } from '@/lib/supabase'
import type { AppData, ID } from '@/lib/types'
import {
  goalCategoryToRow,
  goalToRow,
  habitToRow,
  lifeAreaToRow,
  pillarToRow,
  profileToRow,
  projectToRow,
  rewardToRow,
  ritualToRow,
  sleepNightToRow,
  taskToRow,
} from './mappers'

/**
 * Sincronización por diferencias.
 *
 * En vez de llamar a Supabase desde cada una de las ~25 acciones del store
 * —donde olvidarse una sola significa un dato que nunca se guarda— se compara
 * el estado anterior con el nuevo y se deduce qué cambió. Es imposible olvidar
 * un caso: si el dato está en `AppData`, entra en el diff.
 */

interface Diff<T> {
  upserts: T[]
  deletes: string[]
}

function diffById<T extends { id: ID }>(prev: T[], next: T[]): Diff<T> {
  const before = new Map(prev.map((item) => [item.id, item]))
  const upserts = next.filter((item) => {
    const old = before.get(item.id)
    return !old || JSON.stringify(old) !== JSON.stringify(item)
  })
  const nextIds = new Set(next.map((item) => item.id))
  return { upserts, deletes: prev.filter((i) => !nextIds.has(i.id)).map((i) => i.id) }
}

function diffByKey<T>(prev: Record<string, T>, next: Record<string, T>): {
  upserts: Array<[string, T]>
  deletes: string[]
} {
  const upserts: Array<[string, T]> = []
  for (const [key, value] of Object.entries(next)) {
    const old = prev[key]
    if (!old || JSON.stringify(old) !== JSON.stringify(value)) upserts.push([key, value])
  }
  const deletes = Object.keys(prev).filter((key) => !(key in next))
  return { upserts, deletes }
}

/** Devuelve las marcas de hábito agregadas y quitadas entre dos estados. */
function diffHabitLogs(
  prev: AppData['habitLogs'],
  next: AppData['habitLogs'],
): { added: Array<{ habitId: ID; day: string }>; removed: Array<{ habitId: ID; day: string }> } {
  const added: Array<{ habitId: ID; day: string }> = []
  const removed: Array<{ habitId: ID; day: string }> = []

  const habitIds = new Set([...Object.keys(prev), ...Object.keys(next)])
  for (const habitId of habitIds) {
    const before = new Set(prev[habitId] ?? [])
    const after = new Set(next[habitId] ?? [])
    for (const day of after) if (!before.has(day)) added.push({ habitId, day })
    for (const day of before) if (!after.has(day)) removed.push({ habitId, day })
  }
  return { added, removed }
}

/* ------------------------------------------------------------------ escritura */

async function run(label: string, action: PromiseLike<{ error: unknown }>) {
  const { error } = await action
  if (error) {
    const message = (error as { message?: string }).message ?? String(error)
    throw new Error(`${label}: ${message}`)
  }
}

/**
 * Empuja a Supabase todo lo que cambió entre `prev` y `next`.
 * Lanza si algo falla, para que la capa de arriba pueda avisar.
 */
export async function pushChanges(
  prev: AppData,
  next: AppData,
  userId: string,
): Promise<void> {
  /* ------------------------------------------------------------- perfil */
  if (JSON.stringify(prev.profile) !== JSON.stringify(next.profile)) {
    await run('perfil', supabase.from('profiles').upsert(profileToRow(next.profile, userId)))
  }

  /* ------------------------------------------------------------ hábitos */
  const habits = diffById(prev.habits, next.habits)
  if (habits.upserts.length) {
    await run(
      'hábitos',
      supabase.from('habits').upsert(habits.upserts.map((h) => habitToRow(h, userId))),
    )
  }
  if (habits.deletes.length) {
    await run('borrar hábitos', supabase.from('habits').delete().in('id', habits.deletes))
  }

  // Las marcas de un hábito borrado ya cayeron por cascada: intentar borrarlas
  // una por una serían decenas de llamadas que no hacen nada.
  const deletedHabits = new Set(habits.deletes)
  const logs = diffHabitLogs(prev.habitLogs, next.habitLogs)
  logs.removed = logs.removed.filter((mark) => !deletedHabits.has(mark.habitId))
  if (logs.added.length) {
    await run(
      'marcas',
      supabase
        .from('habit_logs')
        .upsert(
          logs.added.map((l) => ({ habit_id: l.habitId, user_id: userId, day: l.day })),
          { onConflict: 'habit_id,day' },
        ),
    )
  }
  for (const mark of logs.removed) {
    await run(
      'quitar marca',
      supabase.from('habit_logs').delete().eq('habit_id', mark.habitId).eq('day', mark.day),
    )
  }

  /* --------------------------------------------------- pilares y proyectos */
  const pillars = diffById(prev.pillars, next.pillars)
  if (pillars.upserts.length) {
    await run(
      'pilares',
      supabase
        .from('pillars')
        .upsert(pillars.upserts.map((p) => pillarToRow(p, userId, next.pillars.indexOf(p)))),
    )
  }
  if (pillars.deletes.length) {
    await run('borrar pilares', supabase.from('pillars').delete().in('id', pillars.deletes))
  }

  const projects = diffById(prev.projects, next.projects)
  if (projects.upserts.length) {
    await run(
      'proyectos',
      supabase
        .from('projects')
        .upsert(projects.upserts.map((p) => projectToRow(p, userId, next.projects.indexOf(p)))),
    )
  }
  if (projects.deletes.length) {
    await run('borrar proyectos', supabase.from('projects').delete().in('id', projects.deletes))
  }

  /* ------------------------------------------------------------- rituales */
  const rituals = diffByKey(prev.rituals, next.rituals)
  for (const [day, ritual] of rituals.upserts) {
    await run('ritual', supabase.from('rituals').upsert(ritualToRow(ritual, userId)))
    // Los proyectos del día se reemplazan enteros: son pocos y así no hay que
    // diferenciar altas de bajas dentro del propio ritual.
    await run(
      'limpiar proyectos del ritual',
      supabase.from('ritual_projects').delete().eq('day', day).eq('user_id', userId),
    )
    if (ritual.projectIds.length) {
      await run(
        'proyectos del ritual',
        supabase
          .from('ritual_projects')
          .insert(
            ritual.projectIds.map((id) => ({ user_id: userId, day, project_id: id })),
          ),
      )
    }
  }
  for (const day of rituals.deletes) {
    await run('borrar ritual', supabase.from('rituals').delete().eq('day', day).eq('user_id', userId))
  }

  /* --------------------------------------------------------------- tareas */
  const tasks = diffById(prev.tasks, next.tasks)
  if (tasks.upserts.length) {
    // Las tareas padre van primero: una subtarea con `parent_id` que todavía no
    // existe viola la foreign key.
    const parents = tasks.upserts.filter((t) => t.parentId === null)
    const children = tasks.upserts.filter((t) => t.parentId !== null)
    if (parents.length) {
      await run('tareas', supabase.from('tasks').upsert(parents.map((t) => taskToRow(t, userId))))
    }
    if (children.length) {
      await run(
        'subtareas',
        supabase.from('tasks').upsert(children.map((t) => taskToRow(t, userId))),
      )
    }
  }
  if (tasks.deletes.length) {
    await run('borrar tareas', supabase.from('tasks').delete().in('id', tasks.deletes))
  }

  /* -------------------------------------------------------------- premios */
  const rewards = diffByKey(prev.rewards, next.rewards)
  for (const [weekStart, reward] of rewards.upserts) {
    await run(
      'premio',
      supabase
        .from('week_rewards')
        .upsert(rewardToRow(weekStart, reward.text, reward.claimed, userId)),
    )
  }

  /* -------------------------------------------------------------- journal
     Sólo se sincroniza `closedAt`. Las grabaciones tienen su propio camino en
     `remote/audio.ts`: subir un archivo es una operación explícita, lenta y
     que puede fallar sola, y no puede colgarse de un diff debounceado. */
  const journalClosed = (entries: AppData['journal']) =>
    Object.fromEntries(Object.entries(entries).map(([day, e]) => [day, e.closedAt]))

  const journal = diffByKey(journalClosed(prev.journal), journalClosed(next.journal))
  for (const [day, closedAt] of journal.upserts) {
    await run(
      'journal',
      supabase.from('journal_entries').upsert({ user_id: userId, day, closed_at: closedAt }),
    )
  }
  for (const day of journal.deletes) {
    await run(
      'borrar journal',
      supabase.from('journal_entries').delete().eq('day', day).eq('user_id', userId),
    )
  }

  /* ------------------------------------------------------------ objetivos */
  const categories = diffById(prev.goalCategories, next.goalCategories)
  if (categories.upserts.length) {
    await run(
      'secciones',
      supabase
        .from('goal_categories')
        .upsert(categories.upserts.map((c) => goalCategoryToRow(c, userId))),
    )
  }
  if (categories.deletes.length) {
    await run(
      'borrar secciones',
      supabase.from('goal_categories').delete().in('id', categories.deletes),
    )
  }

  const goals = diffById(prev.goals, next.goals)
  if (goals.upserts.length) {
    await run('objetivos', supabase.from('goals').upsert(goals.upserts.map((g) => goalToRow(g, userId))))
  }
  if (goals.deletes.length) {
    await run('borrar objetivos', supabase.from('goals').delete().in('id', goals.deletes))
  }

  /* --------------------------------------------------------- rueda de vida */
  const areas = diffById(prev.lifeAreas, next.lifeAreas)
  if (areas.upserts.length) {
    await run(
      'áreas',
      supabase.from('life_areas').upsert(areas.upserts.map((a) => lifeAreaToRow(a, userId))),
    )
  }
  if (areas.deletes.length) {
    await run('borrar áreas', supabase.from('life_areas').delete().in('id', areas.deletes))
  }

  const wheel = diffByKey(prev.wheel, next.wheel)
  for (const [month, entry] of wheel.upserts) {
    const rows = Object.entries(entry.scores).map(([areaId, score]) => ({
      user_id: userId,
      // La base guarda el día 1 del mes, no `YYYY-MM`.
      month: `${month}-01`,
      area_id: areaId,
      score,
    }))
    if (rows.length) {
      await run('puntajes', supabase.from('wheel_scores').upsert(rows))
    }
  }

  /* ---------------------------------------------------------------- sueño */
  const sleep = diffByKey(prev.sleep, next.sleep)
  if (sleep.upserts.length) {
    await run(
      'noches',
      supabase
        .from('sleep_nights')
        .upsert(sleep.upserts.map(([, night]) => sleepNightToRow(night, userId))),
    )
  }
  for (const date of sleep.deletes) {
    await run(
      'borrar noche',
      supabase.from('sleep_nights').delete().eq('night', date).eq('user_id', userId),
    )
  }
}
