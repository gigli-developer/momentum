import { useMemo, useState } from 'react'
import { addMonths, isSameMonth, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, PieChart } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/Button'
import { capitalize, fmt, monthKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { LIFE_AREAS, type LifeAreaId, type WheelScores } from '@/lib/types'
import { RadarChart, RadarLegend, type RadarSeries } from './RadarChart'

const NEUTRAL: WheelScores = {
  salud: 5,
  familia: 5,
  trabajo: 5,
  ocio: 5,
  tiempo: 5,
  emocional: 5,
  educativa: 5,
  espiritual: 5,
}

export function WheelPage() {
  const [cursor, setCursor] = useState(() => new Date())
  const [highlight, setHighlight] = useState<LifeAreaId | null>(null)

  const wheel = useStore((s) => s.wheel)
  const setWheelScore = useStore((s) => s.setWheelScore)

  const currentKey = monthKey(cursor)
  const previousKey = monthKey(subMonths(cursor, 1))
  const current = wheel[currentKey]?.scores ?? NEUTRAL
  const previous = wheel[previousKey]?.scores

  const series = useMemo<RadarSeries[]>(() => {
    const list: RadarSeries[] = [
      {
        id: 'current',
        label: capitalize(fmt(cursor, 'MMMM')),
        scores: current,
        color: 'var(--color-accent)',
        fillOpacity: 0.16,
      },
    ]
    if (previous) {
      list.push({
        id: 'previous',
        label: capitalize(fmt(subMonths(cursor, 1), 'MMMM')),
        scores: previous,
        color: 'var(--color-cat-7)',
        dashed: true,
        fillOpacity: 0.06,
      })
    }
    return list
  }, [cursor, current, previous])

  const average = useMemo(() => {
    const values = LIFE_AREAS.map((a) => current[a.id] ?? 0)
    return values.reduce((acc, v) => acc + v, 0) / values.length
  }, [current])

  const weakest = useMemo(
    () =>
      LIFE_AREAS.reduce((min, area) =>
        (current[area.id] ?? 0) < (current[min.id] ?? 0) ? area : min,
      ),
    [current],
  )

  const isCurrentMonth = isSameMonth(cursor, new Date())

  return (
    <>
      <PageHeader
        icon={<PieChart className="size-5" />}
        title="Rueda de la vida"
        description="Evaluá tu equilibrio en las áreas clave de tu vida."
        action={
          <div className="flex items-center gap-1">
            <IconButton label="Mes anterior" onClick={() => setCursor((c) => subMonths(c, 1))}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="min-w-32 text-center text-sm text-ink-muted">
              {capitalize(fmt(cursor, 'MMMM yyyy'))}
            </span>
            <IconButton
              label="Mes siguiente"
              disabled={isCurrentMonth}
              onClick={() => setCursor((c) => addMonths(c, 1))}
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <RadarChart series={series} highlight={highlight} />
          <RadarLegend series={series} />

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Panel>
              <SectionTitle>Promedio</SectionTitle>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {average.toFixed(1)}
                <span className="text-base font-normal text-ink-faint">/10</span>
              </p>
            </Panel>
            <Panel>
              <SectionTitle>Área más floja</SectionTitle>
              <p className="mt-1 text-sm font-medium text-accent">{weakest.label}</p>
              <p className="text-xs text-ink-muted">{current[weakest.id]}/10 este mes</p>
            </Panel>
          </div>
        </Card>

        <Card>
          <SectionTitle>Puntuá cada área</SectionTitle>
          <p className="mt-1 text-xs text-ink-faint">
            0 = abandonada, 10 = como querés que esté.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {LIFE_AREAS.map((area) => {
              const value = current[area.id] ?? 0
              const prev = previous?.[area.id]
              const delta = prev === undefined ? null : value - prev

              return (
                <div key={area.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <label htmlFor={`area-${area.id}`} className="text-sm text-ink">
                      {area.label}
                    </label>
                    <span className="flex items-baseline gap-1.5 text-sm tabular-nums">
                      {delta !== null && delta !== 0 ? (
                        <span
                          className={delta > 0 ? 'text-positive text-xs' : 'text-negative text-xs'}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      ) : null}
                      <span className="font-semibold">{value}</span>
                    </span>
                  </div>
                  <input
                    id={`area-${area.id}`}
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={value}
                    onChange={(e) => setWheelScore(currentKey, area.id, Number(e.target.value))}
                    onFocus={() => setHighlight(area.id)}
                    onBlur={() => setHighlight(null)}
                    onMouseEnter={() => setHighlight(area.id)}
                    onMouseLeave={() => setHighlight(null)}
                    className="w-full"
                  />
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </>
  )
}
