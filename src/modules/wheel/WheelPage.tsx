import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { addMonths, isSameMonth, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, PieChart, Sparkles, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { InlineAdd, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { capitalize, fmt, monthKey } from '@/lib/date'
import { snapshot, useStore } from '@/lib/store'
import {
  MAX_LIFE_AREAS,
  MIN_LIFE_AREAS,
  type ID,
  type WheelSourceKind,
} from '@/lib/types'
import { RadarChart, RadarLegend, type RadarSeries } from './RadarChart'
import { SOURCE_LABELS, autoScoreFor } from './autoScore'

const SOURCE_KINDS: WheelSourceKind[] = ['manual', 'habits', 'sleep', 'tasks', 'goals', 'energy']

export function WheelPage() {
  const [cursor, setCursor] = useState(() => new Date())
  const [highlight, setHighlight] = useState<ID | null>(null)
  const [editing, setEditing] = useState<ID | null>(null)

  const data = useStore(useShallow(snapshot))
  const setWheelScore = useStore((s) => s.setWheelScore)
  const addLifeArea = useStore((s) => s.addLifeArea)
  const renameLifeArea = useStore((s) => s.renameLifeArea)
  const setLifeAreaSource = useStore((s) => s.setLifeAreaSource)
  const removeLifeArea = useStore((s) => s.removeLifeArea)

  const areas = data.lifeAreas
  const currentKey = monthKey(cursor)
  const previousKey = monthKey(subMonths(cursor, 1))

  /**
   * El puntaje de un área: si es automática se calcula al vuelo, y sólo cae al
   * valor manual cuando el cálculo no tiene datos con qué trabajar.
   */
  const scoresFor = useMemo(() => {
    return (month: string) => {
      const stored = data.wheel[month]?.scores
      const out: Record<ID, number> = {}
      const detail: Record<ID, string | null> = {}
      for (const area of areas) {
        const auto = autoScoreFor(area, data, month)
        if (auto) {
          out[area.id] = auto.value
          detail[area.id] = auto.detail
        } else {
          out[area.id] = stored?.[area.id] ?? 5
          detail[area.id] = null
        }
      }
      return { scores: out, detail }
    }
  }, [areas, data])

  const current = useMemo(() => scoresFor(currentKey), [scoresFor, currentKey])
  const previous = useMemo(() => scoresFor(previousKey), [scoresFor, previousKey])
  const hasPreviousData = data.wheel[previousKey] !== undefined || areas.some((a) => a.source.kind !== 'manual')

  const series = useMemo<RadarSeries[]>(() => {
    const list: RadarSeries[] = [
      {
        id: 'current',
        label: capitalize(fmt(cursor, 'MMMM')),
        scores: current.scores,
        color: 'var(--color-accent)',
        fillOpacity: 0.16,
      },
    ]
    if (hasPreviousData) {
      list.push({
        id: 'previous',
        label: capitalize(fmt(subMonths(cursor, 1), 'MMMM')),
        scores: previous.scores,
        color: 'var(--color-cat-7)',
        dashed: true,
        fillOpacity: 0.06,
      })
    }
    return list
  }, [cursor, current, previous, hasPreviousData])

  const average = useMemo(() => {
    if (areas.length === 0) return 0
    return areas.reduce((acc, a) => acc + current.scores[a.id], 0) / areas.length
  }, [areas, current])

  const weakest = useMemo(
    () =>
      areas.length === 0
        ? null
        : areas.reduce((min, area) =>
            current.scores[area.id] < current.scores[min.id] ? area : min,
          ),
    [areas, current],
  )

  const autoCount = areas.filter((a) => a.source.kind !== 'manual').length
  const isCurrentMonth = isSameMonth(cursor, new Date())
  const canRemove = areas.length > MIN_LIFE_AREAS
  const canAdd = areas.length < MAX_LIFE_AREAS

  return (
    <>
      <PageHeader
        icon={<PieChart className="size-5" />}
        title="Rueda de la vida"
        description="Cada área puede puntuarse a mano o calcularse sola desde el resto de la app."
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

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          {areas.length < MIN_LIFE_AREAS ? (
            <EmptyState
              icon={<PieChart className="size-5" />}
              title="Necesitás al menos 3 áreas"
              description="Con menos de tres ejes no se forma la rueda. Agregá las que quieras evaluar en el panel de la derecha."
            />
          ) : (
            <>
              <RadarChart areas={areas} series={series} highlight={highlight} />
              <RadarLegend series={series} />

              <div className="mt-5 grid grid-cols-3 gap-3">
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
                      <p className="text-xs text-ink-muted tabular-nums">
                        {current.scores[weakest.id].toFixed(1)}/10
                      </p>
                    </>
                  ) : null}
                </Panel>
                <Panel>
                  <SectionTitle>Automáticas</SectionTitle>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {autoCount}
                    <span className="text-base font-normal text-ink-faint">/{areas.length}</span>
                  </p>
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
            Tocá el nombre para renombrar, o el ícono de la derecha para elegir de dónde sale el
            número.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {areas.map((area) => {
              const value = current.scores[area.id]
              const detail = current.detail[area.id]
              const isAuto = detail !== null
              const prev = previous.scores[area.id]
              const delta = hasPreviousData ? Math.round((value - prev) * 10) / 10 : null
              const isEditing = editing === area.id

              return (
                <div key={area.id} className="group">
                  <div className="mb-1.5 flex items-center gap-2">
                    <input
                      value={area.label}
                      onChange={(e) => renameLifeArea(area.id, e.target.value)}
                      onFocus={() => setHighlight(area.id)}
                      onBlur={(e) => {
                        setHighlight(null)
                        if (!e.target.value.trim()) renameLifeArea(area.id, 'Área sin nombre')
                      }}
                      aria-label={`Nombre del área ${area.label}`}
                      className="min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-ink transition-colors hover:border-line hover:bg-surface-2 focus:border-accent/60 focus:bg-surface-2 focus:outline-none"
                    />

                    <span className="flex shrink-0 items-baseline gap-1.5 text-sm tabular-nums">
                      {delta !== null && delta !== 0 ? (
                        <span
                          className={delta > 0 ? 'text-xs text-positive' : 'text-xs text-negative'}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      ) : null}
                      <span className="font-semibold">{value.toFixed(1)}</span>
                    </span>

                    <IconButton
                      label={`Configurar origen de ${area.label}`}
                      title={isAuto ? SOURCE_LABELS[area.source.kind] : 'Lo puntúo yo'}
                      className={cn('shrink-0', isAuto && 'text-accent')}
                      onClick={() => setEditing(isEditing ? null : area.id)}
                    >
                      <Sparkles className={cn('size-3.5', isAuto && 'fill-current')} />
                    </IconButton>

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

                  {isAuto ? (
                    <div
                      className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
                      onMouseEnter={() => setHighlight(area.id)}
                      onMouseLeave={() => setHighlight(null)}
                    >
                      <span
                        className="bg-accent transition-[width] duration-500"
                        style={{ width: `${value * 10}%` }}
                      />
                    </div>
                  ) : (
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
                  )}

                  {detail ? (
                    <p className="mt-1 text-[11px] text-ink-faint">
                      <Sparkles className="mr-1 inline size-2.5 text-accent" />
                      {detail}
                    </p>
                  ) : null}

                  {isEditing ? (
                    <Panel className="mt-2 p-3">
                      <label
                        htmlFor={`source-${area.id}`}
                        className="mb-1.5 block text-[11px] font-medium text-ink-muted"
                      >
                        ¿De dónde sale este número?
                      </label>
                      <Select
                        id={`source-${area.id}`}
                        value={area.source.kind}
                        onChange={(e) =>
                          setLifeAreaSource(area.id, {
                            kind: e.target.value as WheelSourceKind,
                            habitIds: area.source.habitIds,
                          })
                        }
                      >
                        {SOURCE_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {SOURCE_LABELS[kind]}
                          </option>
                        ))}
                      </Select>

                      {area.source.kind === 'habits' ? (
                        <div className="mt-3">
                          <p className="mb-1.5 text-[11px] font-medium text-ink-muted">
                            ¿Qué hábitos cuentan?
                          </p>
                          {data.habits.length === 0 ? (
                            <p className="text-xs text-ink-faint">
                              Todavía no cargaste hábitos.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {data.habits.map((habit) => (
                                <Checkbox
                                  key={habit.id}
                                  checked={area.source.habitIds.includes(habit.id)}
                                  label={`${habit.emoji} ${habit.name}`}
                                  onChange={() =>
                                    setLifeAreaSource(area.id, {
                                      kind: 'habits',
                                      habitIds: area.source.habitIds.includes(habit.id)
                                        ? area.source.habitIds.filter((h) => h !== habit.id)
                                        : [...area.source.habitIds, habit.id],
                                    })
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}

                      {area.source.kind !== 'manual' && !isAuto ? (
                        <p className="mt-3 text-[11px] text-negative">
                          Todavía no hay datos para calcular esto, así que se usa el valor manual.
                        </p>
                      ) : null}
                    </Panel>
                  ) : null}
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
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <p className="text-xs text-ink-muted">
          Los puntajes automáticos <strong className="text-ink">no se guardan</strong>: se
          recalculan cada vez. Si corregís un hábito de hace tres meses, la rueda de ese mes se
          actualiza sola. Las áreas que dependen de cómo te sentís —familia, ocio, tiempo para
          vos— no se pueden derivar de ningún dato y por eso quedan manuales.
        </p>
      </Card>
    </>
  )
}
