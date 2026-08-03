import { useMemo, useState } from 'react'
import { addMonths, isSameMonth, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, PieChart, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/Button'
import { InlineAdd } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { capitalize, fmt, monthKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { MAX_LIFE_AREAS, MIN_LIFE_AREAS, type ID } from '@/lib/types'
import { RadarChart, RadarLegend, type RadarSeries } from './RadarChart'

export function WheelPage() {
  const [cursor, setCursor] = useState(() => new Date())
  const [highlight, setHighlight] = useState<ID | null>(null)

  const areas = useStore((s) => s.lifeAreas)
  const wheel = useStore((s) => s.wheel)
  const setWheelScore = useStore((s) => s.setWheelScore)
  const addLifeArea = useStore((s) => s.addLifeArea)
  const renameLifeArea = useStore((s) => s.renameLifeArea)
  const removeLifeArea = useStore((s) => s.removeLifeArea)

  const currentKey = monthKey(cursor)
  const previousKey = monthKey(subMonths(cursor, 1))
  const current = wheel[currentKey]?.scores
  const previous = wheel[previousKey]?.scores

  /** Un área sin puntaje en este mes cuenta como 5, el medio de la escala. */
  const scoreOf = (areaId: ID) => current?.[areaId] ?? 5

  const series = useMemo<RadarSeries[]>(() => {
    const scores = Object.fromEntries(areas.map((a) => [a.id, current?.[a.id] ?? 5]))
    const list: RadarSeries[] = [
      {
        id: 'current',
        label: capitalize(fmt(cursor, 'MMMM')),
        scores,
        color: 'var(--color-accent)',
        fillOpacity: 0.16,
      },
    ]
    // Sólo mostramos la comparación si el mes anterior tiene datos de estas áreas.
    if (previous && areas.some((a) => previous[a.id] !== undefined)) {
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
  }, [cursor, current, previous, areas])

  const average = useMemo(() => {
    if (areas.length === 0) return 0
    return areas.reduce((acc, a) => acc + scoreOf(a.id), 0) / areas.length
  }, [areas, current])

  const weakest = useMemo(
    () =>
      areas.length === 0
        ? null
        : areas.reduce((min, area) => (scoreOf(area.id) < scoreOf(min.id) ? area : min)),
    [areas, current],
  )

  const isCurrentMonth = isSameMonth(cursor, new Date())
  const canRemove = areas.length > MIN_LIFE_AREAS
  const canAdd = areas.length < MAX_LIFE_AREAS

  return (
    <>
      <PageHeader
        icon={<PieChart className="size-5" />}
        title="Rueda de la vida"
        description="Evaluá tu equilibrio en las áreas clave de tu vida. Las áreas las definís vos."
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

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          {areas.length < MIN_LIFE_AREAS ? (
            <EmptyState
              icon={<PieChart className="size-5" />}
              title="Necesitás al menos 3 áreas"
              description="Con menos de tres ejes no se forma la rueda. Agregá las áreas que quieras evaluar en el panel de la derecha."
            />
          ) : (
            <>
              <RadarChart areas={areas} series={series} highlight={highlight} />
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
                  {weakest ? (
                    <>
                      <p className="mt-1 text-sm font-medium text-accent">{weakest.label}</p>
                      <p className="text-xs text-ink-muted">{scoreOf(weakest.id)}/10 este mes</p>
                    </>
                  ) : null}
                </Panel>
              </div>
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <SectionTitle>Tus áreas</SectionTitle>
            <span className="text-xs text-ink-faint tabular-nums">
              {areas.length}/{MAX_LIFE_AREAS}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            0 = abandonada, 10 = como querés que esté. Tocá el nombre para renombrarla.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {areas.map((area) => {
              const value = scoreOf(area.id)
              const prev = previous?.[area.id]
              const delta = prev === undefined ? null : value - prev

              return (
                <div key={area.id} className="group">
                  <div className="mb-1.5 flex items-center gap-2">
                    <input
                      value={area.label}
                      onChange={(e) => renameLifeArea(area.id, e.target.value)}
                      onFocus={() => setHighlight(area.id)}
                      onBlur={(e) => {
                        setHighlight(null)
                        // Un área sin nombre no se puede identificar en el radar.
                        if (!e.target.value.trim()) renameLifeArea(area.id, 'Área sin nombre')
                      }}
                      aria-label={`Nombre del área ${area.label}`}
                      className="min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-ink transition-colors hover:border-line hover:bg-surface-2 focus:border-accent/60 focus:bg-surface-2 focus:outline-none"
                    />
                    <span className="flex shrink-0 items-baseline gap-1.5 text-sm tabular-nums">
                      {delta !== null && delta !== 0 ? (
                        <span
                          className={
                            delta > 0 ? 'text-xs text-positive' : 'text-xs text-negative'
                          }
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      ) : null}
                      <span className="font-semibold">{value}</span>
                    </span>
                    <IconButton
                      label={`Eliminar ${area.label}`}
                      disabled={!canRemove}
                      title={
                        canRemove
                          ? `Eliminar ${area.label}`
                          : `Tenés que conservar al menos ${MIN_LIFE_AREAS} áreas`
                      }
                      className="shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                      onClick={() => removeLifeArea(area.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={value}
                    onChange={(e) => setWheelScore(currentKey, area.id, Number(e.target.value))}
                    aria-label={`Puntaje de ${area.label}`}
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

          <Panel className="mt-5">
            <SectionTitle className="mb-2">Nueva área</SectionTitle>
            {canAdd ? (
              <InlineAdd placeholder="Ej: Finanzas personales" onAdd={addLifeArea} />
            ) : (
              <p className="text-xs text-ink-faint">
                Llegaste al máximo de {MAX_LIFE_AREAS} áreas. Más ejes que eso y el radar deja de
                leerse.
              </p>
            )}
          </Panel>

          {previous && areas.some((a) => previous[a.id] === undefined) ? (
            <p className="mt-3 text-xs text-ink-faint">
              Las áreas que agregaste después arrancan sin dato del mes anterior, así que no
              aparecen en la comparación hasta el mes que viene.
            </p>
          ) : null}
        </Card>
      </div>
    </>
  )
}
