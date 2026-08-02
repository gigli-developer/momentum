import { LIFE_AREAS, type WheelScores } from '@/lib/types'

export interface RadarSeries {
  id: string
  label: string
  scores: WheelScores
  color: string
  /** El trazo punteado distingue la serie de comparación sin bajar el contraste. */
  dashed?: boolean
  fillOpacity?: number
}

const SIZE = 380
const CENTER = SIZE / 2
const RADIUS = 118
const MAX = 10
const RINGS = [2, 4, 6, 8, 10]

function angleOf(index: number): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / LIFE_AREAS.length
}

function point(index: number, value: number): [number, number] {
  const theta = angleOf(index)
  const r = (value / MAX) * RADIUS
  return [CENTER + r * Math.cos(theta), CENTER + r * Math.sin(theta)]
}

function polygon(values: number[]): string {
  return values.map((v, i) => point(i, v).join(',')).join(' ')
}

/** Parte etiquetas largas en dos líneas para que no se pisen con el gráfico. */
function wrap(label: string): string[] {
  if (label.length <= 12) return [label]
  const words = label.split(' ')
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

interface RadarChartProps {
  series: RadarSeries[]
  /** Resalta un área mientras se edita su puntaje. */
  highlight?: string | null
}

export function RadarChart({ series, highlight }: RadarChartProps) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto w-full max-w-[380px]"
      role="img"
      aria-label={`Rueda de la vida: ${series.map((s) => s.label).join(' y ')}`}
    >
      {/* Anillos de referencia */}
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={polygon(LIFE_AREAS.map(() => ring))}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={1}
        />
      ))}

      {/* Ejes */}
      {LIFE_AREAS.map((area, i) => {
        const [x, y] = point(i, MAX)
        return (
          <line
            key={area.id}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke={highlight === area.id ? 'var(--color-accent)' : 'var(--color-line)'}
            strokeWidth={highlight === area.id ? 1.5 : 1}
          />
        )
      })}

      {/* Series: la de comparación se dibuja primero para quedar por debajo */}
      {[...series].reverse().map((s) => {
        const values = LIFE_AREAS.map((a) => s.scores[a.id] ?? 0)
        return (
          <g key={s.id}>
            <polygon
              points={polygon(values)}
              fill={s.color}
              fillOpacity={s.fillOpacity ?? 0.14}
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? '5 4' : undefined}
            />
            {!s.dashed
              ? values.map((v, i) => {
                  const [x, y] = point(i, v)
                  return <circle key={i} cx={x} cy={y} r={3} fill={s.color} />
                })
              : null}
          </g>
        )
      })}

      {/* Etiquetas de las áreas */}
      {LIFE_AREAS.map((area, i) => {
        const theta = angleOf(i)
        const lx = CENTER + (RADIUS + 26) * Math.cos(theta)
        const ly = CENTER + (RADIUS + 26) * Math.sin(theta)
        const cos = Math.cos(theta)
        const anchor = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end'
        const lines = wrap(area.label)
        const active = highlight === area.id

        return (
          <text
            key={area.id}
            x={lx}
            y={ly - (lines.length - 1) * 6}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="text-[10px]"
            fill={active ? 'var(--color-accent)' : 'var(--color-ink-muted)'}
            fontWeight={active ? 600 : 400}
          >
            {lines.map((line, li) => (
              <tspan key={line} x={lx} dy={li === 0 ? 0 : 12}>
                {line}
              </tspan>
            ))}
          </text>
        )
      })}
    </svg>
  )
}

export function RadarLegend({ series }: { series: RadarSeries[] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      {series.map((s) => (
        <li key={s.id} className="flex items-center gap-2 text-xs text-ink-muted">
          <span
            className="inline-block h-2.5 w-5 rounded-full"
            style={{
              backgroundColor: s.dashed ? 'transparent' : s.color,
              border: s.dashed ? `2px dashed ${s.color}` : undefined,
            }}
            aria-hidden
          />
          {s.label}
        </li>
      ))}
    </ul>
  )
}
