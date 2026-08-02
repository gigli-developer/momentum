import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { monthKey, todayISO, weekStartISO } from './date'
import { buildEmpty, buildSeed } from './seed'
import { STORAGE_KEY, appStorage, newId } from './storage'
import type {
  AppData,
  Dream,
  FocusSettings,
  Goal,
  Habit,
  ID,
  ISODate,
  ISOMonth,
  LifeAreaId,
  Pillar,
  Profile,
  Quarter,
  RitualEntry,
  Scope,
  Task,
} from './types'

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
  addTask: (date: ISODate, title: string) => void
  toggleTask: (id: ID) => void
  updateTask: (id: ID, patch: Partial<Omit<Task, 'id'>>) => void
  removeTask: (id: ID) => void
  setReward: (weekStart: ISODate, text: string) => void
  claimReward: (weekStart: ISODate) => void

  /* Sueños y objetivos */
  addDream: (scope: Scope, title: string) => void
  updateDream: (id: ID, patch: Partial<Omit<Dream, 'id'>>) => void
  toggleDream: (id: ID) => void
  removeDream: (id: ID) => void
  addGoal: (input: { scope: Scope; title: string; year: number; quarter: Quarter; dreamId: ID | null }) => void
  updateGoal: (id: ID, patch: Partial<Omit<Goal, 'id'>>) => void
  toggleGoal: (id: ID) => void
  removeGoal: (id: ID) => void

  /* Rueda de la vida */
  setWheelScore: (month: ISOMonth, area: LifeAreaId, value: number) => void

  /* Enfoque */
  updateFocusSettings: (patch: Partial<FocusSettings>) => void
  logFocusSession: (minutes: number, label: string) => void

  /* Datos */
  replaceAll: (data: AppData) => void
  resetToSeed: () => void
  resetToEmpty: () => void
}

export type Store = AppData & Actions

const EMPTY_SCORES = {
  salud: 5,
  familia: 5,
  trabajo: 5,
  ocio: 5,
  tiempo: 5,
  emocional: 5,
  educativa: 5,
  espiritual: 5,
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...buildSeed(),

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
      addTask: (date, title) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: newId(),
              date,
              title,
              done: false,
              order: s.tasks.filter((t) => t.date === date).length,
            },
          ],
        })),

      toggleTask: (id) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),

      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

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

      /* ------------------------------------------- Sueños y objetivos */
      addDream: (scope, title) =>
        set((s) => ({
          dreams: [
            ...s.dreams,
            { id: newId(), scope, title, achieved: false, createdAt: todayISO() },
          ],
        })),

      updateDream: (id, patch) =>
        set((s) => ({ dreams: s.dreams.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

      toggleDream: (id) =>
        set((s) => ({
          dreams: s.dreams.map((d) => (d.id === id ? { ...d, achieved: !d.achieved } : d)),
        })),

      // Los objetivos que colgaban del sueño no se borran: quedan sueltos.
      removeDream: (id) =>
        set((s) => ({
          dreams: s.dreams.filter((d) => d.id !== id),
          goals: s.goals.map((g) => (g.dreamId === id ? { ...g, dreamId: null } : g)),
        })),

      addGoal: ({ scope, title, year, quarter, dreamId }) =>
        set((s) => ({
          goals: [
            ...s.goals,
            { id: newId(), scope, title, year, quarter, dreamId, done: false, createdAt: todayISO() },
          ],
        })),

      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

      toggleGoal: (id) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)) })),

      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      /* ------------------------------------------------ Rueda de la vida */
      setWheelScore: (month, area, value) =>
        set((s) => {
          const entry = s.wheel[month] ?? { month, scores: { ...EMPTY_SCORES } }
          return {
            wheel: {
              ...s.wheel,
              [month]: { month, scores: { ...entry.scores, [area]: value } },
            },
          }
        }),

      /* ---------------------------------------------------------- Enfoque */
      updateFocusSettings: (patch) =>
        set((s) => ({ focusSettings: { ...s.focusSettings, ...patch } })),

      logFocusSession: (minutes, label) =>
        set((s) => ({
          focusSessions: [
            { id: newId(), finishedAt: new Date().toISOString(), minutes, label },
            ...s.focusSessions,
          ].slice(0, 500),
        })),

      /* ------------------------------------------------------------ Datos */
      replaceAll: (data) => set(() => ({ ...data })),
      resetToSeed: () => set(() => ({ ...buildSeed() })),
      resetToEmpty: () => set(() => ({ ...buildEmpty() })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => appStorage),
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
        dreams: s.dreams,
        goals: s.goals,
        wheel: s.wheel,
        focusSettings: s.focusSettings,
        focusSessions: s.focusSessions,
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
    dreams: s.dreams,
    goals: s.goals,
    wheel: s.wheel,
    focusSettings: s.focusSettings,
    focusSessions: s.focusSessions,
  }
}
