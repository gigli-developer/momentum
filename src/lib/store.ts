import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { monthKey, todayISO, weekStartISO } from './date'
import { buildEmpty, buildSeed, defaultGoalCategories, defaultLifeAreas } from './seed'
import { STORAGE_KEY, appStorage, newId } from './storage'
import { isRemoteConfigured } from './supabase'
import type {
  AppData,
  Goal,
  Habit,
  ID,
  ISODate,
  ISOMonth,
  JournalEntry,
  JournalRecording,
  LifeArea,
  Pillar,
  Profile,
  Quarter,
  RitualEntry,
  SleepNight,
  Task,
  WheelSource,
} from './types'
import { MAX_LIFE_AREAS, MIN_GOAL_CATEGORIES, MIN_LIFE_AREAS } from './types'

interface Actions {
  /* Perfil */
  updateProfile: (patch: Partial<Profile>) => void

  /* Hábitos */
  addHabit: (input: { name: string; emoji: string }) => void
  updateHabit: (id: ID, patch: Partial<Omit<Habit, 'id'>>) => void
  removeHabit: (id: ID) => void
  toggleHabitDay: (habitId: ID, date: ISODate) => void

  /* Ritual */
  ensureRitual: (date: ISODate) => RitualEntry
  updateRitual: (date: ISODate, patch: Partial<Omit<RitualEntry, 'date'>>) => void
  toggleRitualProject: (date: ISODate, projectId: ID) => void
  completeRitual: (date: ISODate) => void
  addPillar: (input: Omit<Pillar, 'id'>) => void
  removePillar: (id: ID) => void
  addProject: (input: { name: string; emoji: string }) => void
  removeProject: (id: ID) => void

  /* Planificador */
  addTask: (date: ISODate, title: string, parentId?: ID | null) => void
  toggleTask: (id: ID) => void
  toggleTaskStar: (id: ID) => void
  updateTask: (id: ID, patch: Partial<Omit<Task, 'id'>>) => void
  removeTask: (id: ID) => void
  setReward: (weekStart: ISODate, text: string) => void
  claimReward: (weekStart: ISODate) => void

  /* Journal */
  addJournalRecording: (date: ISODate, recording: JournalRecording) => void
  removeJournalRecording: (date: ISODate, recordingId: ID) => void
  toggleJournalClosed: (date: ISODate) => void

  /* Objetivos */
  addGoalCategory: (label: string) => void
  renameGoalCategory: (id: ID, label: string) => void
  removeGoalCategory: (id: ID) => void
  addGoal: (input: { categoryId: ID; title: string; year: number; quarter: Quarter }) => void
  updateGoal: (id: ID, patch: Partial<Omit<Goal, 'id'>>) => void
  toggleGoal: (id: ID) => void
  removeGoal: (id: ID) => void

  /* Sueño */
  upsertSleepNight: (night: SleepNight) => void
  importSleepNights: (nights: SleepNight[]) => void
  removeSleepNight: (date: ISODate) => void

  /* Rueda de la vida */
  setWheelScore: (month: ISOMonth, areaId: ID, value: number) => void
  addLifeArea: (label: string) => void
  renameLifeArea: (id: ID, label: string) => void
  setLifeAreaSource: (id: ID, source: WheelSource) => void
  removeLifeArea: (id: ID) => void

  /* Datos */
  replaceAll: (data: AppData) => void
  resetToSeed: () => void
  resetToEmpty: () => void
}

export type Store = AppData & Actions

/** Un mes sin puntuar arranca en 5 (el medio) para todas las áreas vigentes. */
function neutralScores(areas: LifeArea[]): Record<ID, number> {
  return Object.fromEntries(areas.map((a) => [a.id, 5]))
}

function emptyJournalEntry(date: ISODate): JournalEntry {
  return { date, recordings: [], closedAt: null }
}

/**
 * Con Supabase configurado la app arranca vacía y se hidrata al iniciar sesión.
 * Sembrar datos de ejemplo ahí haría que se vean hábitos falsos por un instante
 * antes de que lleguen los reales, y peor: el sincronizador los subiría.
 */
const initialData = isRemoteConfigured ? buildEmpty() : buildSeed()

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialData,

      /* --------------------------------------------------------- Perfil */
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      /* -------------------------------------------------------- Hábitos */
      addHabit: ({ name, emoji }) =>
        set((s) => ({
          habits: [
            ...s.habits,
            {
              id: newId(),
              name,
              emoji,
              colorIndex: s.habits.length % 8,
              createdAt: todayISO(),
              archived: false,
              order: s.habits.length,
            },
          ],
        })),

      updateHabit: (id, patch) =>
        set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),

      removeHabit: (id) =>
        set((s) => ({
          habits: s.habits.filter((h) => h.id !== id),
          habitLogs: Object.fromEntries(
            Object.entries(s.habitLogs).filter(([habitId]) => habitId !== id),
          ),
        })),

      toggleHabitDay: (habitId, date) =>
        set((s) => {
          const current = s.habitLogs[habitId] ?? []
          const next = current.includes(date)
            ? current.filter((d) => d !== date)
            : [...current, date].sort()
          return { habitLogs: { ...s.habitLogs, [habitId]: next } }
        }),

      /* --------------------------------------------------------- Ritual */
      ensureRitual: (date) => {
        const existing = get().rituals[date]
        if (existing) return existing
        const fresh: RitualEntry = {
          date,
          mission: '',
          pillarId: null,
          sapo: '',
          sapoDone: false,
          projectIds: [],
          energy: 3,
          completedAt: null,
        }
        set((s) => ({ rituals: { ...s.rituals, [date]: fresh } }))
        return fresh
      },

      updateRitual: (date, patch) =>
        set((s) => {
          const base = s.rituals[date] ?? {
            date,
            mission: '',
            pillarId: null,
            sapo: '',
            sapoDone: false,
            projectIds: [],
            energy: 3,
            completedAt: null,
          }
          return { rituals: { ...s.rituals, [date]: { ...base, ...patch } } }
        }),

      toggleRitualProject: (date, projectId) => {
        const current = get().rituals[date]?.projectIds ?? []
        get().updateRitual(date, {
          projectIds: current.includes(projectId)
            ? current.filter((id) => id !== projectId)
            : [...current, projectId],
        })
      },

      completeRitual: (date) => get().updateRitual(date, { completedAt: new Date().toISOString() }),

      addPillar: (input) => set((s) => ({ pillars: [...s.pillars, { ...input, id: newId() }] })),

      removePillar: (id) =>
        set((s) => ({
          pillars: s.pillars.filter((p) => p.id !== id),
          rituals: Object.fromEntries(
            Object.entries(s.rituals).map(([k, r]) => [
              k,
              r.pillarId === id ? { ...r, pillarId: null } : r,
            ]),
          ),
        })),

      addProject: ({ name, emoji }) =>
        set((s) => ({ projects: [...s.projects, { id: newId(), name, emoji, archived: false }] })),

      removeProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          rituals: Object.fromEntries(
            Object.entries(s.rituals).map(([k, r]) => [
              k,
              { ...r, projectIds: r.projectIds.filter((pid) => pid !== id) },
            ]),
          ),
        })),

      /* -------------------------------------------------- Planificador */
      addTask: (date, title, parentId = null) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: newId(),
              date,
              title,
              note: '',
              done: false,
              starred: false,
              parentId,
              order: s.tasks.filter((t) => t.date === date && t.parentId === parentId).length,
            },
          ],
        })),

      // Completar una tarea padre completa sus subtareas: no tiene sentido una
      // tarea terminada con pendientes colgando adentro.
      toggleTask: (id) =>
        set((s) => {
          const target = s.tasks.find((t) => t.id === id)
          if (!target) return s
          const next = !target.done
          return {
            tasks: s.tasks.map((t) => {
              if (t.id === id) return { ...t, done: next }
              if (next && t.parentId === id) return { ...t, done: true }
              return t
            }),
          }
        }),

      toggleTaskStar: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, starred: !t.starred } : t)),
        })),

      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      // Borrar un padre se lleva sus subtareas, o quedan huérfanas e invisibles.
      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id && t.parentId !== id) })),

      setReward: (start, text) =>
        set((s) => ({
          rewards: {
            ...s.rewards,
            [start]: { weekStart: start, text, claimed: s.rewards[start]?.claimed ?? false },
          },
        })),

      claimReward: (start) =>
        set((s) => ({
          rewards: {
            ...s.rewards,
            [start]: {
              weekStart: start,
              text: s.rewards[start]?.text ?? '',
              claimed: !s.rewards[start]?.claimed,
            },
          },
        })),

      /* -------------------------------------------------------- Journal */
      addJournalRecording: (date, recording) =>
        set((s) => {
          const entry = s.journal[date] ?? emptyJournalEntry(date)
          return {
            journal: {
              ...s.journal,
              [date]: { ...entry, recordings: [...entry.recordings, recording] },
            },
          }
        }),

      // El blob se borra aparte, desde la página: el store no hace IO async.
      removeJournalRecording: (date, recordingId) =>
        set((s) => {
          const entry = s.journal[date]
          if (!entry) return s
          return {
            journal: {
              ...s.journal,
              [date]: {
                ...entry,
                recordings: entry.recordings.filter((r) => r.id !== recordingId),
              },
            },
          }
        }),

      toggleJournalClosed: (date) =>
        set((s) => {
          const entry = s.journal[date] ?? emptyJournalEntry(date)
          return {
            journal: {
              ...s.journal,
              [date]: { ...entry, closedAt: entry.closedAt ? null : new Date().toISOString() },
            },
          }
        }),

      /* ------------------------------------------------------ Objetivos */
      addGoalCategory: (label) =>
        set((s) => ({
          goalCategories: [
            ...s.goalCategories,
            { id: newId(), label, order: s.goalCategories.length },
          ],
        })),

      renameGoalCategory: (id, label) =>
        set((s) => ({
          goalCategories: s.goalCategories.map((c) => (c.id === id ? { ...c, label } : c)),
        })),

      // Se lleva puestos sus objetivos: la UI confirma antes, mostrando cuántos.
      removeGoalCategory: (id) =>
        set((s) => {
          if (s.goalCategories.length <= MIN_GOAL_CATEGORIES) return s
          return {
            goalCategories: s.goalCategories
              .filter((c) => c.id !== id)
              .map((c, i) => ({ ...c, order: i })),
            goals: s.goals.filter((g) => g.categoryId !== id),
          }
        }),

      addGoal: ({ categoryId, title, year, quarter }) =>
        set((s) => ({
          goals: [
            ...s.goals,
            { id: newId(), categoryId, title, year, quarter, done: false, createdAt: todayISO() },
          ],
        })),

      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

      toggleGoal: (id) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)) })),

      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      /* ---------------------------------------------------------- Sueño */
      upsertSleepNight: (night) =>
        set((s) => ({ sleep: { ...s.sleep, [night.date]: night } })),

      // El import pisa lo que ya había para esas fechas: el export de Salud es
      // más confiable que una carga manual vieja.
      importSleepNights: (nights) =>
        set((s) => ({
          sleep: { ...s.sleep, ...Object.fromEntries(nights.map((n) => [n.date, n])) },
        })),

      removeSleepNight: (date) =>
        set((s) => ({
          sleep: Object.fromEntries(Object.entries(s.sleep).filter(([key]) => key !== date)),
        })),

      /* ------------------------------------------------ Rueda de la vida */
      setWheelScore: (month, areaId, value) =>
        set((s) => {
          const entry = s.wheel[month] ?? { month, scores: neutralScores(s.lifeAreas) }
          return {
            wheel: {
              ...s.wheel,
              [month]: { month, scores: { ...entry.scores, [areaId]: value } },
            },
          }
        }),

      addLifeArea: (label) =>
        set((s) => {
          if (s.lifeAreas.length >= MAX_LIFE_AREAS) return s
          const area: LifeArea = {
            id: newId(),
            label,
            order: s.lifeAreas.length,
            source: { kind: 'manual', habitIds: [] },
          }
          // El área nueva arranca en 5 en todos los meses ya puntuados, para que
          // el polígono no se hunda hacia el centro de golpe.
          const wheel = Object.fromEntries(
            Object.entries(s.wheel).map(([month, entry]) => [
              month,
              { ...entry, scores: { ...entry.scores, [area.id]: 5 } },
            ]),
          )
          return { lifeAreas: [...s.lifeAreas, area], wheel }
        }),

      renameLifeArea: (id, label) =>
        set((s) => ({
          lifeAreas: s.lifeAreas.map((a) => (a.id === id ? { ...a, label } : a)),
        })),

      setLifeAreaSource: (id, source) =>
        set((s) => ({
          lifeAreas: s.lifeAreas.map((a) => (a.id === id ? { ...a, source } : a)),
        })),

      removeLifeArea: (id) =>
        set((s) => {
          if (s.lifeAreas.length <= MIN_LIFE_AREAS) return s
          // Se limpian también los puntajes históricos: si no, quedan colgados
          // en el export y reaparecerían al reimportar.
          const wheel = Object.fromEntries(
            Object.entries(s.wheel).map(([month, entry]) => [
              month,
              {
                ...entry,
                scores: Object.fromEntries(
                  Object.entries(entry.scores).filter(([areaId]) => areaId !== id),
                ),
              },
            ]),
          )
          return {
            lifeAreas: s.lifeAreas
              .filter((a) => a.id !== id)
              .map((a, i) => ({ ...a, order: i })),
            wheel,
          }
        }),

      /* ------------------------------------------------------------ Datos */
      replaceAll: (data) => set(() => ({ ...data })),
      resetToSeed: () => set(() => ({ ...buildSeed() })),
      resetToEmpty: () => set(() => ({ ...buildEmpty() })),
    }),
    {
      name: STORAGE_KEY,
      version: 6,
      storage: createJSONStorage(() => appStorage),
      // Sin migración, quien ya venía usando la app se queda sin áreas (la rueda
      // revienta) o sin la clave del journal.
      migrate: (persisted, version) => {
        const data = persisted as Record<string, unknown>
        // v1 → v2: áreas de la rueda como datos; se eliminó el temporizador.
        if (version < 2) {
          if (!Array.isArray(data.lifeAreas)) data.lifeAreas = defaultLifeAreas()
          delete data.focusSettings
          delete data.focusSessions
        }
        // v2 → v3: aparece el journal.
        if (version < 3) {
          if (typeof data.journal !== 'object' || data.journal === null) data.journal = {}
        }
        // v3 → v4: secciones de objetivos como datos, se eliminan los sueños y
        // las tareas ganan nota, estrella y subtareas.
        if (version < 4) {
          if (!Array.isArray(data.goalCategories)) data.goalCategories = defaultGoalCategories()
          if (Array.isArray(data.goals)) {
            data.goals = (data.goals as Array<Record<string, unknown>>).map((goal) => {
              const { scope, dreamId, ...rest } = goal
              void dreamId
              // Los ids por defecto coinciden con los valores viejos de `scope`.
              return { ...rest, categoryId: goal.categoryId ?? scope ?? 'personal' }
            })
          }
          if (Array.isArray(data.tasks)) {
            data.tasks = (data.tasks as Array<Record<string, unknown>>).map((task) => ({
              note: '',
              starred: false,
              parentId: null,
              ...task,
            }))
          }
          delete data.dreams
        }
        // v4 → v5: aparece el módulo de sueño.
        if (version < 5) {
          if (typeof data.sleep !== 'object' || data.sleep === null) data.sleep = {}
          const profile = data.profile as Record<string, unknown> | undefined
          if (profile && typeof profile.sleepTargetMinutes !== 'number') {
            profile.sleepTargetMinutes = 480
          }
        }
        // v5 → v6: cada área de la rueda declara de dónde sale su puntaje.
        // Las existentes quedan en manual: cambiar en silencio cómo se calcula
        // un dato que el usuario ya cargó sería peor que no automatizar nada.
        if (version < 6) {
          if (Array.isArray(data.lifeAreas)) {
            data.lifeAreas = (data.lifeAreas as Array<Record<string, unknown>>).map((area) => ({
              source: { kind: 'manual', habitIds: [] },
              ...area,
            }))
          }
        }
        return data as unknown as AppData
      },
      // Sólo persistimos datos: las acciones se reconstruyen en cada arranque.
      partialize: (s): AppData => ({
        profile: s.profile,
        habits: s.habits,
        habitLogs: s.habitLogs,
        pillars: s.pillars,
        projects: s.projects,
        rituals: s.rituals,
        tasks: s.tasks,
        rewards: s.rewards,
        journal: s.journal,
        goalCategories: s.goalCategories,
        goals: s.goals,
        lifeAreas: s.lifeAreas,
        wheel: s.wheel,
        sleep: s.sleep,
      }),
    },
  ),
)

/* --------------------------------------------------------------- Selectores
   Funciones puras sobre el estado; los componentes las usan con useStore(). */

export const selectTasksForDate = (date: ISODate) => (s: Store) =>
  s.tasks.filter((t) => t.date === date).sort((a, b) => a.order - b.order)

export const selectRitual = (date: ISODate) => (s: Store) => s.rituals[date]

export const selectCurrentReward = (s: Store) => s.rewards[weekStartISO()]

export const selectWheel = (month: ISOMonth) => (s: Store) => s.wheel[month]

export const selectThisMonthWheel = (s: Store) => s.wheel[monthKey(new Date())]

export const selectActiveHabits = (s: Store) =>
  s.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order)

/** Datos exportables, sin las acciones. */
export function snapshot(s: Store): AppData {
  return {
    profile: s.profile,
    habits: s.habits,
    habitLogs: s.habitLogs,
    pillars: s.pillars,
    projects: s.projects,
    rituals: s.rituals,
    tasks: s.tasks,
    rewards: s.rewards,
    journal: s.journal,
    goalCategories: s.goalCategories,
    goals: s.goals,
    lifeAreas: s.lifeAreas,
    wheel: s.wheel,
    sleep: s.sleep,
  }
}
