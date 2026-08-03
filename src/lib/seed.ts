import { addDays, differenceInCalendarDays, subDays, subMonths } from 'date-fns'
import { monthKey, toISO, todayISO, weekStart, weekStartISO } from './date'
import type { AppData, Goal, Habit, LifeArea, Task, WheelScores } from './types'

/**
 * Áreas por defecto de la rueda. El usuario las puede renombrar, borrar o sumar
 * las suyas; estos ids se mantienen estables porque son los que traía la v1.
 */
export function defaultLifeAreas(): LifeArea[] {
  return [
    { id: 'salud', label: 'Salud y deporte', order: 0 },
    { id: 'familia', label: 'Familia y amor', order: 1 },
    { id: 'trabajo', label: 'Trabajo y finanzas', order: 2 },
    { id: 'ocio', label: 'Ocio y amistad', order: 3 },
    { id: 'tiempo', label: 'Tiempo para mí', order: 4 },
    { id: 'emocional', label: 'Emocional', order: 5 },
    { id: 'educativa', label: 'Educativa y cultural', order: 6 },
    { id: 'espiritual', label: 'Espiritual y ética', order: 7 },
  ]
}

/** PRNG determinístico: el seed se ve igual en cada carga y en cada máquina. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HABIT_SEEDS: Array<Pick<Habit, 'name' | 'emoji' | 'colorIndex'> & { rate: number }> = [
  { name: 'Dormir 8h', emoji: '😴', colorIndex: 0, rate: 0.72 },
  { name: 'Meditar', emoji: '🧘', colorIndex: 1, rate: 0.57 },
  { name: 'Ejercicio', emoji: '🏋️', colorIndex: 2, rate: 0.8 },
  { name: "Leer 10'", emoji: '📖', colorIndex: 3, rate: 0.5 },
  { name: 'Tomar sol', emoji: '☀️', colorIndex: 4, rate: 0.63 },
  { name: 'Atardecer', emoji: '🌇', colorIndex: 5, rate: 0.44 },
  { name: 'Creatina', emoji: '💊', colorIndex: 6, rate: 0.7 },
  { name: 'Beber agua', emoji: '💧', colorIndex: 7, rate: 0.66 },
]

const TASK_GROUPS: Array<{ titles: string[]; doneIdx: number[] }> = [
  {
    titles: [
      'Lanzar landing',
      'Cenar con Fede',
      'Almorzar algo rico y nutritivo',
      'Ver el atardecer',
      'Ir a entrenar',
      'Llamar a mi familia',
      'Salir a caminar',
    ],
    doneIdx: [2, 4],
  },
  {
    titles: [
      'Sesión con Fede',
      'Sesión con Julieta',
      'Cena con Mar',
      'Armar sistema para Sofi (abogada)',
      'Ir al mar a la mañana',
      'Cortarme el pelo',
    ],
    doneIdx: [],
  },
  { titles: ['Revisar métricas de la semana', 'Comprar regalo'], doneIdx: [] },
]

const THIS_MONTH: WheelScores = {
  salud: 8,
  familia: 7,
  trabajo: 6,
  ocio: 5,
  tiempo: 4,
  emocional: 7,
  educativa: 6,
  espiritual: 5,
}

const LAST_MONTH: WheelScores = {
  salud: 6,
  familia: 6,
  trabajo: 7,
  ocio: 4,
  tiempo: 3,
  emocional: 5,
  educativa: 5,
  espiritual: 4,
}

/**
 * Datos de ejemplo para que la app no arranque vacía.
 * Todo se genera relativo a hoy, así el seed nunca "envejece".
 */
export function buildSeed(): AppData {
  const rnd = mulberry32(20260802)
  const today = new Date()
  const now = todayISO()

  const pillars = [
    {
      id: 'pillar-productividad',
      name: 'Productividad',
      emoji: '🎯',
      description: 'Ejecutar con claridad lo que realmente importa.',
    },
    {
      id: 'pillar-cuerpo',
      name: 'Cuerpo',
      emoji: '💪',
      description: 'Energía física como base de todo lo demás.',
    },
    {
      id: 'pillar-vinculos',
      name: 'Vínculos',
      emoji: '🤝',
      description: 'Estar presente con la gente que elijo.',
    },
    {
      id: 'pillar-mente',
      name: 'Mente',
      emoji: '🧠',
      description: 'Calma, foco y criterio propio.',
    },
  ]

  const projects = [
    { id: 'proj-orden', name: 'Sistema de Orden Personal', emoji: '🗂️', archived: false },
    { id: 'proj-cuerpo', name: 'Cuerpo Físico', emoji: '🏃', archived: false },
    { id: 'proj-marca', name: 'Marca personal', emoji: '✨', archived: false },
  ]

  const habits: Habit[] = HABIT_SEEDS.map((h, i) => ({
    id: `habit-${i}`,
    name: h.name,
    emoji: h.emoji,
    colorIndex: h.colorIndex,
    createdAt: toISO(subDays(today, 120)),
    archived: false,
    order: i,
  }))

  // 90 días de historial con rachas plausibles por hábito.
  const habitLogs: Record<string, string[]> = {}
  HABIT_SEEDS.forEach((h, i) => {
    const days: string[] = []
    let momentum = 0
    for (let d = 89; d >= 0; d--) {
      // El tope evita rachas irreales de 70+ días en los datos de ejemplo.
      const chance = Math.min(0.88, h.rate + momentum * 0.04)
      if (rnd() < chance) {
        days.push(toISO(subDays(today, d)))
        momentum = Math.min(3, momentum + 1)
      } else {
        momentum = 0
      }
    }
    habitLogs[`habit-${i}`] = days
  })

  // Los grupos arrancan en hoy y siguen hacia adelante; si hoy es fin de semana
  // retroceden, así el seed nunca deja el día actual vacío.
  const monday = weekStart(today)
  const todayOffset = Math.max(0, Math.min(6, differenceInCalendarDays(today, monday)))
  const tasks: Task[] = []
  TASK_GROUPS.forEach((group, g) => {
    const offset =
      todayOffset + g <= 6 ? todayOffset + g : Math.max(0, todayOffset - (g - (6 - todayOffset)))
    const date = toISO(addDays(monday, offset))
    group.titles.forEach((title, idx) => {
      tasks.push({
        id: `task-${g}-${idx}`,
        date,
        title,
        done: group.doneIdx.includes(idx),
        order: idx,
      })
    })
  })

  const dreams = [
    {
      id: 'dream-referente',
      scope: 'professional' as const,
      title: 'Ser referente en mi profesión',
      achieved: false,
      createdAt: now,
    },
    {
      id: 'dream-nomade',
      scope: 'professional' as const,
      title: 'Vivir viajando mientras trabajo desde donde quiero',
      achieved: false,
      createdAt: now,
    },
    {
      id: 'dream-mar',
      scope: 'personal' as const,
      title: 'Vivir en una casa frente al mar',
      achieved: false,
      createdAt: now,
    },
    {
      id: 'dream-maraton',
      scope: 'personal' as const,
      title: 'Correr una maratón entera',
      achieved: false,
      createdAt: now,
    },
  ]

  const year = today.getFullYear()
  const goals: Goal[] = [
    {
      id: 'goal-1',
      scope: 'professional',
      dreamId: 'dream-nomade',
      title: 'Soltar los clientes de Diseño Web que me drenaban',
      year,
      quarter: 1,
      done: true,
      createdAt: now,
    },
    {
      id: 'goal-2',
      scope: 'professional',
      dreamId: 'dream-referente',
      title: 'Certificarme como Coach de Alto Rendimiento',
      year,
      quarter: 2,
      done: true,
      createdAt: now,
    },
    {
      id: 'goal-3',
      scope: 'professional',
      dreamId: 'dream-referente',
      title: 'Publicar 20 ensayos sobre productividad',
      year,
      quarter: 3,
      done: false,
      createdAt: now,
    },
    {
      id: 'goal-4',
      scope: 'professional',
      dreamId: 'dream-nomade',
      title: 'Cerrar el año con 6 meses de runway',
      year,
      quarter: 4,
      done: false,
      createdAt: now,
    },
    {
      id: 'goal-5',
      scope: 'personal',
      dreamId: 'dream-maraton',
      title: 'Correr mis primeros 21k',
      year,
      quarter: 3,
      done: false,
      createdAt: now,
    },
    {
      id: 'goal-6',
      scope: 'personal',
      dreamId: 'dream-mar',
      title: 'Pasar un mes entero viviendo en la costa',
      year,
      quarter: 1,
      done: true,
      createdAt: now,
    },
  ]

  return {
    profile: {
      name: 'Lucas',
      birthDate: '1992-07-04',
      lifeExpectancy: 80,
    },
    habits,
    habitLogs,
    pillars,
    projects,
    rituals: {
      [now]: {
        date: now,
        mission: 'Ir a ver el mar',
        pillarId: 'pillar-productividad',
        sapo: 'Cortarme el pelo',
        sapoDone: false,
        projectIds: ['proj-orden', 'proj-cuerpo'],
        energy: 4,
        completedAt: null,
      },
    },
    tasks,
    rewards: {
      [weekStartISO(today)]: { weekStart: weekStartISO(today), text: '', claimed: false },
    },
    // El journal arranca vacío: las grabaciones son del usuario, no se simulan.
    journal: {},
    dreams,
    goals,
    lifeAreas: defaultLifeAreas(),
    wheel: {
      [monthKey(today)]: { month: monthKey(today), scores: THIS_MONTH },
      [monthKey(subMonths(today, 1))]: {
        month: monthKey(subMonths(today, 1)),
        scores: LAST_MONTH,
      },
    },
  }
}

/** Estado vacío, para cuando el usuario quiere arrancar de cero. */
export function buildEmpty(): AppData {
  return {
    profile: { name: '', birthDate: '', lifeExpectancy: 80 },
    habits: [],
    habitLogs: {},
    pillars: [],
    projects: [],
    rituals: {},
    tasks: [],
    rewards: {},
    journal: {},
    dreams: [],
    goals: [],
    lifeAreas: defaultLifeAreas(),
    wheel: {},
  }
}
