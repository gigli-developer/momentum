import { addDays, differenceInCalendarDays, subDays, subMonths } from 'date-fns'
import { monthKey, toISO, todayISO, weekStart, weekStartISO } from './date'
import type {
  AppData,
  Goal,
  GoalCategory,
  Habit,
  LifeArea,
  SleepNight,
  Task,
  WheelScores,
} from './types'

/**
 * Secciones por defecto de Objetivos. El usuario puede renombrarlas, borrarlas
 * o sumar las suyas; estos ids son los valores que traía el campo `scope`.
 */
export function defaultGoalCategories(): GoalCategory[] {
  return [
    { id: 'personal', label: 'Personal', order: 0 },
    { id: 'professional', label: 'Profesional', order: 1 },
  ]
}

/**
 * Áreas por defecto de la rueda. El usuario las puede renombrar, borrar o sumar
 * las suyas; estos ids se mantienen estables porque son los que traía la v1.
 */
export function defaultLifeAreas(): LifeArea[] {
  const manual = { kind: 'manual' as const, habitIds: [] }
  return [
    // Las áreas que tienen datos detrás arrancan automáticas; las que dependen
    // de cómo te sentís (familia, ocio, tiempo propio) no se pueden derivar de
    // nada y quedan manuales a propósito.
    {
      id: 'salud',
      label: 'Salud y deporte',
      order: 0,
      source: { kind: 'habits', habitIds: ['habit-2', 'habit-0'] },
    },
    { id: 'familia', label: 'Familia y amor', order: 1, source: manual },
    { id: 'trabajo', label: 'Trabajo y finanzas', order: 2, source: { kind: 'tasks', habitIds: [] } },
    { id: 'ocio', label: 'Ocio y amistad', order: 3, source: manual },
    { id: 'tiempo', label: 'Tiempo para mí', order: 4, source: manual },
    { id: 'emocional', label: 'Emocional', order: 5, source: { kind: 'energy', habitIds: [] } },
    {
      id: 'educativa',
      label: 'Educativa y cultural',
      order: 6,
      source: { kind: 'habits', habitIds: ['habit-3'] },
    },
    {
      id: 'espiritual',
      label: 'Espiritual y ética',
      order: 7,
      source: { kind: 'habits', habitIds: ['habit-1'] },
    },
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

interface SeedTask {
  title: string
  note?: string
  done?: boolean
  starred?: boolean
  subtasks?: Array<{ title: string; done?: boolean; starred?: boolean }>
}

const TASK_GROUPS: SeedTask[][] = [
  [
    {
      title: 'Automatización ZAR',
      subtasks: [
        { title: 'Probar 5 statements viejos para corroborar fiabilidad', starred: true },
        { title: 'Cruce con intraday Encore' },
      ],
    },
    { title: 'Indagar reemplazo alteryx EDO (si existe)', starred: true },
    { title: 'Coordinar Personal Days', note: 'Uno tengo que guardarlo para el turno de moto' },
    { title: 'Almorzar algo rico y nutritivo', done: true },
    { title: 'Ir a entrenar', done: true },
    { title: 'Ver el atardecer' },
  ],
  [
    { title: 'Sesión con Fede' },
    { title: 'Cena con Mar' },
    {
      title: 'Alteryx Books - All Regions',
      subtasks: [{ title: 'Limpiar/Definir Related Masters y LE' }],
    },
    { title: 'Cortarme el pelo' },
  ],
  [
    { title: 'Automatizar reconciliación de Brasil' },
    { title: 'Revisar métricas de la semana' },
  ],
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
 * 45 noches con la forma que tiene el sueño real: se duerme tarde los viernes
 * y sábados, y las proporciones de fases rondan lo que reporta un Apple Watch
 * (profundo ~15%, REM ~22%, core el resto).
 */
function buildSleepNights(rnd: () => number, today: Date): Record<string, SleepNight> {
  const nights: Record<string, SleepNight> = {}

  for (let d = 45; d >= 1; d--) {
    const morning = subDays(today, d)
    const weekday = morning.getDay() // 0 domingo, 6 sábado
    const lateNight = weekday === 6 || weekday === 0 // amanece sábado o domingo

    // Hora de acostarse: base 23:30, más tarde los fines de semana.
    const bedMinutes = (lateNight ? 24 * 60 + 50 : 23 * 60 + 30) + Math.round((rnd() - 0.5) * 70)
    const inBed = (lateNight ? 465 : 450) + Math.round((rnd() - 0.5) * 90)
    const awake = 12 + Math.round(rnd() * 22)
    const asleep = inBed - awake

    const deep = Math.round(asleep * (0.13 + rnd() * 0.05))
    const rem = Math.round(asleep * (0.19 + rnd() * 0.07))
    const core = asleep - deep - rem

    const bedtime = new Date(morning)
    bedtime.setHours(0, 0, 0, 0)
    bedtime.setMinutes(bedMinutes - 24 * 60)

    const wakeTime = new Date(bedtime.getTime() + inBed * 60_000)

    nights[toISO(morning)] = {
      date: toISO(morning),
      bedtime: bedtime.toISOString(),
      wakeTime: wakeTime.toISOString(),
      asleepMinutes: asleep,
      inBedMinutes: inBed,
      stages: { awake, rem, core, deep, unspecified: 0 },
      source: 'import',
      updatedAt: wakeTime.toISOString(),
    }
  }

  return nights
}

const MISSIONS = [
  'Ir a ver el mar',
  'Cerrar la automatización de una vez',
  'Salir a correr antes de abrir la compu',
  'Llamar a mamá sin apuro',
  'Terminar el informe y soltar',
  'Un día sin reuniones',
  'Cocinar algo que me guste',
]

/**
 * Rituales de los últimos 14 días. La energía se deriva del sueño de esa noche
 * más ruido, para que el cruce sueño/energía del módulo tenga algo real que
 * mostrar en vez de un estado vacío.
 */
function buildRituals(
  rnd: () => number,
  today: Date,
  sleep: Record<string, SleepNight>,
): AppData['rituals'] {
  const rituals: AppData['rituals'] = {}
  const pillarIds = ['pillar-productividad', 'pillar-cuerpo', 'pillar-vinculos', 'pillar-mente']

  for (let d = 14; d >= 0; d--) {
    const day = subDays(today, d)
    const date = toISO(day)
    const night = sleep[date]

    // 7 h de sueño ≈ energía 3; cada hora extra suma ~1 punto, con ruido.
    const base = night ? 3 + (night.asleepMinutes - 420) / 60 : 3
    const energy = Math.max(1, Math.min(5, Math.round(base + (rnd() - 0.5) * 1.6)))

    rituals[date] = {
      date,
      mission: d === 0 ? 'Ir a ver el mar' : MISSIONS[d % MISSIONS.length],
      pillarId: pillarIds[d % pillarIds.length],
      sapo: d === 0 ? 'Cortarme el pelo' : '',
      sapoDone: d !== 0 && rnd() > 0.4,
      projectIds: d === 0 ? ['proj-orden', 'proj-cuerpo'] : [],
      energy,
      // El de hoy queda abierto: es el que el usuario va a completar.
      completedAt: d === 0 ? null : subDays(today, d).toISOString(),
    }
  }

  return rituals
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
  const sleepNights = buildSleepNights(rnd, today)

  const monday = weekStart(today)
  const todayOffset = Math.max(0, Math.min(6, differenceInCalendarDays(today, monday)))
  const tasks: Task[] = []
  TASK_GROUPS.forEach((group, g) => {
    const offset =
      todayOffset + g <= 6 ? todayOffset + g : Math.max(0, todayOffset - (g - (6 - todayOffset)))
    const date = toISO(addDays(monday, offset))
    group.forEach((seedTask, idx) => {
      const parentId = `task-${g}-${idx}`
      tasks.push({
        id: parentId,
        date,
        title: seedTask.title,
        note: seedTask.note ?? '',
        done: seedTask.done ?? false,
        starred: seedTask.starred ?? false,
        parentId: null,
        order: idx,
      })
      seedTask.subtasks?.forEach((sub, subIdx) => {
        tasks.push({
          id: `${parentId}-${subIdx}`,
          date,
          title: sub.title,
          note: '',
          done: sub.done ?? false,
          starred: sub.starred ?? false,
          parentId,
          order: subIdx,
        })
      })
    })
  })

  const year = today.getFullYear()
  const goals: Goal[] = [
    {
      id: 'goal-1',
      categoryId: 'professional',
      title: 'Soltar los clientes de Diseño Web que me drenaban',
      year,
      quarter: 1,
      done: true,
      createdAt: now,
    },
    {
      id: 'goal-2',
      categoryId: 'professional',
      title: 'Certificarme como Coach de Alto Rendimiento',
      year,
      quarter: 2,
      done: true,
      createdAt: now,
    },
    {
      id: 'goal-3',
      categoryId: 'professional',
      title: 'Publicar 20 ensayos sobre productividad',
      year,
      quarter: 3,
      done: false,
      createdAt: now,
    },
    {
      id: 'goal-4',
      categoryId: 'professional',
      title: 'Cerrar el año con 6 meses de runway',
      year,
      quarter: 4,
      done: false,
      createdAt: now,
    },
    {
      id: 'goal-5',
      categoryId: 'personal',
      title: 'Correr mis primeros 21k',
      year,
      quarter: 3,
      done: false,
      createdAt: now,
    },
    {
      id: 'goal-6',
      categoryId: 'personal',
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
      sleepTargetMinutes: 480,
    },
    sleep: sleepNights,
    habits,
    habitLogs,
    pillars,
    projects,
    rituals: buildRituals(rnd, today, sleepNights),
    tasks,
    rewards: {
      [weekStartISO(today)]: { weekStart: weekStartISO(today), text: '', claimed: false },
    },
    // El journal arranca vacío: las grabaciones son del usuario, no se simulan.
    journal: {},
    goalCategories: defaultGoalCategories(),
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
    profile: { name: '', birthDate: '', lifeExpectancy: 80, sleepTargetMinutes: 480 },
    sleep: {},
    habits: [],
    habitLogs: {},
    pillars: [],
    projects: [],
    rituals: {},
    tasks: [],
    rewards: {},
    journal: {},
    goalCategories: defaultGoalCategories(),
    goals: [],
    lifeAreas: defaultLifeAreas(),
    wheel: {},
  }
}
