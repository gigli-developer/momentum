import {
  BarChart3,
  CalendarDays,
  CircleCheckBig,
  Hourglass,
  Moon,
  NotebookPen,
  PieChart,
  Settings,
  Sun,
  Target,
} from 'lucide-react'
import type { ComponentType } from 'react'

export interface ModuleDef {
  id: string
  path: string
  title: string
  description: string
  Icon: ComponentType<{ className?: string }>
  /** Los ajustes no entran en la grilla del inicio. */
  hiddenInGrid?: boolean
}

export const MODULES: ModuleDef[] = [
  {
    id: 'habitos',
    path: '/habitos',
    title: 'Panel de hábitos',
    description: 'Construí hábitos sólidos y seguí tu progreso día a día.',
    Icon: CircleCheckBig,
  },
  {
    id: 'ritual',
    path: '/ritual',
    title: 'Ritual Matutino',
    description: 'Empezá el día con intención, claridad y foco.',
    Icon: Sun,
  },
  {
    id: 'semana',
    path: '/semana',
    title: 'Planificador semanal',
    description: 'Organizá tu semana, tus tareas y tu enfoque.',
    Icon: CalendarDays,
  },
  {
    id: 'journal',
    path: '/journal',
    title: 'Journal',
    description: 'Cerrá el día: tildá lo que cumpliste y grabate leyendo tu journal.',
    Icon: NotebookPen,
  },
  {
    id: 'sueno',
    path: '/sueno',
    title: 'Sueño',
    description: 'Lo que mide tu Apple Watch cada noche, cruzado con tu energía.',
    Icon: Moon,
  },
  {
    id: 'objetivos',
    path: '/objetivos',
    title: 'Objetivos y metas',
    description: 'Definí tus objetivos y alcanzá metas personales y profesionales.',
    Icon: Target,
  },
  {
    id: 'rueda',
    path: '/rueda',
    title: 'Rueda de la vida',
    description: 'Evaluá tu equilibrio en las áreas clave de tu vida.',
    Icon: PieChart,
  },
  {
    id: 'estadisticas',
    path: '/estadisticas',
    title: 'Estadísticas y rachas',
    description: 'Visualizá tu progreso, rachas y mejores hábitos.',
    Icon: BarChart3,
  },
  {
    id: 'memento',
    path: '/memento',
    title: 'Memento Mori',
    description: 'Recordá lo que realmente importa y viví con propósito.',
    Icon: Hourglass,
  },
  {
    id: 'ajustes',
    path: '/ajustes',
    title: 'Ajustes',
    description: 'Perfil, pilares, proyectos y tus datos.',
    Icon: Settings,
    hiddenInGrid: true,
  },
]

export const GRID_MODULES = MODULES.filter((m) => !m.hiddenInGrid)
