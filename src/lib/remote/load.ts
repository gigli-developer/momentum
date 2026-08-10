import { supabase } from '@/lib/supabase'
import { buildEmpty } from '@/lib/seed'
import type { AppData, ISODate, JournalEntry, RitualEntry } from '@/lib/types'
import {
  rowToGoal,
  rowToGoalCategory,
  rowToHabit,
  rowToLifeArea,
  rowToPillar,
  rowToProfile,
  rowToProject,
  rowToRecording,
  rowToRitual,
  rowToSleepNight,
  rowToTask,
} from './mappers'

/**
 * Trae TODO el estado del usuario de una sola vez.
 *
 * Los datos de una persona son chicos —unos pocos miles de filas incluso
 * después de años— así que traer todo al iniciar sesión sale más barato en
 * complejidad que paginar y sincronizar por módulo. La app queda instantánea
 * después de la carga inicial.
 */
export async function loadAll(userId: string): Promise<AppData> {
  const [
    profile,
    habits,
    habitLogs,
    pillars,
    projects,
    rituals,
    ritualProjects,
    tasks,
    rewards,
    journalEntries,
    recordings,
    goalCategories,
    goals,
    lifeAreas,
    wheelScores,
    sleepNights,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('habits').select('*').order('sort_order'),
    supabase.from('habit_logs').select('habit_id, day'),
    supabase.from('pillars').select('*').order('sort_order'),
    supabase.from('projects').select('*').order('sort_order'),
    supabase.from('rituals').select('*'),
    supabase.from('ritual_projects').select('day, project_id'),
    supabase.from('tasks').select('*').order('sort_order'),
    supabase.from('week_rewards').select('*'),
    supabase.from('journal_entries').select('*'),
    supabase.from('journal_recordings').select('*').order('recorded_at'),
    supabase.from('goal_categories').select('*').order('sort_order'),
    supabase.from('goals').select('*'),
    supabase.from('life_areas').select('*').order('sort_order'),
    supabase.from('wheel_scores').select('*'),
    supabase.from('sleep_nights').select('*'),
  ])

  // Si algo falló, es mejor romper acá que hidratar la app con datos a medias:
  // el usuario vería su información incompleta y creería que se perdió.
  for (const result of [
    profile,
    habits,
    habitLogs,
    pillars,
    projects,
    rituals,
    ritualProjects,
    tasks,
    rewards,
    journalEntries,
    recordings,
    goalCategories,
    goals,
    lifeAreas,
    wheelScores,
    sleepNights,
  ]) {
    if (result.error) throw new Error(result.error.message)
  }

  const data = buildEmpty()

  if (profile.data) data.profile = rowToProfile(profile.data)

  data.habits = (habits.data ?? []).map(rowToHabit)

  for (const row of habitLogs.data ?? []) {
    const id = String(row.habit_id)
    ;(data.habitLogs[id] ??= []).push(String(row.day))
  }
  for (const days of Object.values(data.habitLogs)) days.sort()

  data.pillars = (pillars.data ?? []).map(rowToPillar)
  data.projects = (projects.data ?? []).map(rowToProject)

  // Los proyectos del ritual vienen en su propia tabla: se agrupan por día
  // antes de armar cada ritual.
  const projectsByDay = new Map<ISODate, string[]>()
  for (const row of ritualProjects.data ?? []) {
    const day = String(row.day)
    const list = projectsByDay.get(day)
    if (list) list.push(String(row.project_id))
    else projectsByDay.set(day, [String(row.project_id)])
  }

  for (const row of rituals.data ?? []) {
    const ritual: RitualEntry = rowToRitual(row, projectsByDay.get(String(row.day)) ?? [])
    data.rituals[ritual.date] = ritual
  }

  data.tasks = (tasks.data ?? []).map(rowToTask)

  for (const row of rewards.data ?? []) {
    data.rewards[String(row.week_start)] = {
      weekStart: String(row.week_start),
      text: String(row.description ?? ''),
      claimed: Boolean(row.claimed),
    }
  }

  for (const row of journalEntries.data ?? []) {
    const entry: JournalEntry = {
      date: String(row.day),
      recordings: [],
      closedAt: row.closed_at ? String(row.closed_at) : null,
    }
    data.journal[entry.date] = entry
  }

  for (const row of recordings.data ?? []) {
    const day = String(row.day)
    // Una grabación sin su día es imposible por la foreign key, pero si el día
    // no llegó por cualquier motivo, lo creamos antes de colgarle el audio.
    data.journal[day] ??= { date: day, recordings: [], closedAt: null }
    data.journal[day].recordings.push(rowToRecording(row))
  }

  data.goalCategories = (goalCategories.data ?? []).map(rowToGoalCategory)
  data.goals = (goals.data ?? []).map(rowToGoal)
  data.lifeAreas = (lifeAreas.data ?? []).map(rowToLifeArea)

  for (const row of wheelScores.data ?? []) {
    // En la base `month` es una fecha (día 1); el dominio usa `YYYY-MM`.
    const month = String(row.month).slice(0, 7)
    data.wheel[month] ??= { month, scores: {} }
    data.wheel[month].scores[String(row.area_id)] = Number(row.score)
  }

  for (const row of sleepNights.data ?? []) {
    const night = rowToSleepNight(row)
    data.sleep[night.date] = night
  }

  return data
}
