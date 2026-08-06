import { useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { subDays } from 'date-fns'
import { Info, Moon, Trash2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Label } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import { capitalize, fmt, lastNDays, toISO, todayISO } from '@/lib/date'
import {
  correlation,
  formatClock,
  formatMinutes,
  sleepSummary,
  sleepVsEnergy,
} from '@/lib/stats'
import { snapshot, useStore } from '@/lib/store'
import type { SleepNight } from '@/lib/types'
import { blankNight, importAppleHealthSleep, type ImportProgress } from './healthImport'

/** Rampa monocromática: cuanto más profunda la fase, más intenso el naranja. */
const STAGE_META = [
  { key: 'deep', label: 'Profundo', color: 'var(--color-ramp-4)' },
  { key: 'rem', label: 'REM', color: 'var(--color-ramp-3)' },
  { key: 'core', label: 'Ligero', color: 'var(--color-ramp-2)' },
  { key: 'unspecified', label: 'Sin fase', color: 'var(--color-ramp-1)' },
  { key: 'awake', label: 'Despierto', color: 'var(--color-surface-3)' },
] as const

function StageBar({ night, className }: { night: SleepNight; className?: string }) {
  const total = night.inBedMinutes || 1
  return (
    <div className={cn('flex h-3 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      {STAGE_META.map(({ key, label, color }) => {
        const minutes = night.stages[key]
        if (minutes <= 0) return null
        return (
          <span
            key={key}
            title={`${label}: ${formatMinutes(minutes)}`}
            style={{ width: `${(minutes / total) * 100}%`, backgroundColor: color }}
          />
        )
      })}
    </div>
  )
}

interface SleepChartProps {
  nights: Array<{ date: string; night: SleepNight | undefined }>
  targetMinutes: number
}

/** Barras de las últimas dos semanas, con la línea del objetivo. */
function SleepChart({ nights, targetMinutes }: SleepChartProps) {
  const max = Math.max(targetMinutes + 90, ...nights.map((n) => n.night?.inBedMinutes ?? 0))

  return (
    <div>
      <div className="relative flex h-40 items-end gap-1.5">
        {/* Línea del objetivo */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/50"
          style={{ bottom: `${(targetMinutes / max) * 100}%` }}
        >
          <span className="absolute -top-4 right-0 text-[10px] text-accent">
            objetivo {formatMinutes(targetMinutes)}
          </span>
        </div>

        {nights.map(({ date, night }) => {
          const asleep = night?.asleepMinutes ?? 0
          const meets = asleep >= targetMinutes
          return (
            <div key={date} className="flex h-full flex-1 flex-col justify-end">
              <div
                title={
                  night
                    ? `${fmt(date, 'EEEE d')}: ${formatMinutes(asleep)}`
                    : `${fmt(date, 'EEEE d')}: sin datos`
                }
                className={cn(
                  'w-full rounded-t-[3px] transition-all',
                  night ? (meets ? 'bg-accent' : 'bg-ramp-3') : 'bg-surface-3',
                )}
                style={{ height: `${Math.max(night ? 4 : 2, (asleep / max) * 100)}%` }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {nights.map(({ date }) => (
          <span key={date} className="flex-1 text-center text-[9px] uppercase text-ink-faint">
            {fmt(date, 'EEEEE')}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SleepPage() {
  const data = useStore(useShallow(snapshot))
  const upsertSleepNight = useStore((s) => s.upsertSleepNight)
  const importSleepNights = useStore((s) => s.importSleepNights)
  const removeSleepNight = useStore((s) => s.removeSleepNight)
  const updateProfile = useStore((s) => s.updateProfile)

  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [manual, setManual] = useState<SleepNight | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const target = data.profile.sleepTargetMinutes
  const summary = useMemo(() => sleepSummary(data.sleep, target, 7), [data.sleep, target])
  const summary30 = useMemo(() => sleepSummary(data.sleep, target, 30), [data.sleep, target])

  const chartNights = useMemo(
    () => lastNDays(14).map((d) => ({ date: toISO(d), night: data.sleep[toISO(d)] })),
    [data.sleep],
  )

  // La "última noche" es la de hoy si ya sincronizó, si no la de ayer.
  const lastNight = data.sleep[todayISO()] ?? data.sleep[toISO(subDays(new Date(), 1))]

  const energyPoints = useMemo(() => sleepVsEnergy(data), [data])
  const energyCorrelation = useMemo(
    () => correlation(energyPoints.map((p) => [p.asleepMinutes, p.energy] as [number, number])),
    [energyPoints],
  )

  async function onImport(file: File) {
    setImportError(null)
    setImportMessage(null)
    setProgress({ bytesRead: 0, totalBytes: file.size, segments: 0 })
    try {
      const result = await importAppleHealthSleep(file, setProgress)
      if (result.nights.length === 0) {
        setImportError(
          'No encontré registros de sueño en el archivo. Fijate que sea export.xml, no el ZIP.',
        )
      } else {
        importSleepNights(result.nights)
        setImportMessage(
          `Importé ${result.nights.length} noches desde ${result.segments} segmentos.`,
        )
      }
    } catch (cause) {
      setImportError(
        cause instanceof Error ? cause.message : 'No pude leer el archivo.',
      )
    } finally {
      setProgress(null)
    }
  }

  const hasData = Object.keys(data.sleep).length > 0

  return (
    <>
      <PageHeader
        icon={<Moon className="size-5" />}
        title="Sueño"
        description="Lo que mide tu Apple Watch cada noche, cruzado con cómo arrancás el día."
        action={
          <Button onClick={() => setManual(blankNight(todayISO()))}>Cargar a mano</Button>
        }
      />

      {!hasData ? (
        <Card>
          <EmptyState
            icon={<Moon className="size-5" />}
            title="Todavía no hay noches cargadas"
            description="Importá el export de la app Salud para traer tu historial, o cargá una noche a mano."
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {/* ------------------------------------------------- Última noche */}
          {lastNight ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <SectionTitle>
                    {lastNight.date === todayISO() ? 'Anoche' : capitalize(fmt(lastNight.date, "EEEE d 'de' MMMM"))}
                  </SectionTitle>
                  <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
                    {formatMinutes(lastNight.asleepMinutes)}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted tabular-nums">
                    {fmt(new Date(lastNight.bedtime), 'HH:mm')} →{' '}
                    {fmt(new Date(lastNight.wakeTime), 'HH:mm')} ·{' '}
                    {formatMinutes(lastNight.inBedMinutes)} en cama
                  </p>
                </div>
                <div className="text-right">
                  <SectionTitle>Objetivo</SectionTitle>
                  <p
                    className={cn(
                      'mt-2 text-2xl font-semibold tabular-nums',
                      lastNight.asleepMinutes >= target ? 'text-positive' : 'text-accent',
                    )}
                  >
                    {lastNight.asleepMinutes >= target ? '✓' : '−'}
                    {formatMinutes(Math.abs(lastNight.asleepMinutes - target))}
                  </p>
                </div>
              </div>

              <StageBar night={lastNight} className="mt-5" />
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                {STAGE_META.map(({ key, label, color }) => (
                  <li key={key} className="flex items-center gap-2 text-xs text-ink-muted">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    {label}
                    <span className="tabular-nums text-ink">
                      {formatMinutes(lastNight.stages[key])}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* ----------------------------------------------- Últimas 2 semanas */}
          <Card>
            <SectionTitle>Últimas dos semanas</SectionTitle>
            <div className="mt-4">
              <SleepChart nights={chartNights} targetMinutes={target} />
            </div>
          </Card>

          {/* ------------------------------------------------------ Resumen */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <SectionTitle>Promedios</SectionTitle>
              <dl className="mt-3 grid gap-2 text-sm">
                <div className="flex justify-between border-b border-line pb-2">
                  <dt className="text-ink-muted">Últimos 7 días ({summary.nights} noches)</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMinutes(summary.averageAsleep)}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-line pb-2">
                  <dt className="text-ink-muted">Últimos 30 días ({summary30.nights} noches)</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMinutes(summary30.averageAsleep)}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-line pb-2">
                  <dt className="text-ink-muted">Eficiencia</dt>
                  <dd className="font-semibold tabular-nums">{summary.efficiency}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Deuda de la semana</dt>
                  <dd className="font-semibold tabular-nums">
                    {summary.debtMinutes === 0 ? '—' : formatMinutes(summary.debtMinutes)}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card>
              <SectionTitle>Regularidad</SectionTitle>
              <p className="mt-3 text-sm text-ink-muted">
                Te acostás en promedio a las{' '}
                <strong className="text-ink tabular-nums">
                  {formatClock(summary.averageBedtime)}
                </strong>
                , con un desvío de{' '}
                <strong className="text-ink tabular-nums">
                  ±{formatMinutes(summary.bedtimeConsistency)}
                </strong>
                .
              </p>
              <ProgressBar
                className="mt-4"
                // 90 min de desvío o más = irregular; 0 = perfecto.
                value={Math.max(0, 100 - (summary.bedtimeConsistency / 90) * 100)}
              />
              <p className="mt-2 text-xs text-ink-faint">
                La hora a la que te acostás, sostenida, predice mejor cómo dormís que la cantidad
                de horas.
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {(['deep', 'rem', 'core'] as const).map((key) => {
                  const meta = STAGE_META.find((m) => m.key === key)!
                  return (
                    <Panel key={key} className="p-3">
                      <p className="text-[11px] text-ink-faint">{meta.label}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">
                        {formatMinutes(summary.stages[key])}
                      </p>
                    </Panel>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* -------------------------------------------- Sueño vs energía */}
          <Card>
            <SectionTitle>Sueño y energía de la mañana</SectionTitle>
            {energyPoints.length < 4 ? (
              <p className="mt-2 text-sm text-ink-faint">
                Hacen falta al menos 4 días con sueño registrado <em>y</em> nivel de energía cargado
                en el ritual matutino. Llevás {energyPoints.length}.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-muted">
                  {energyCorrelation === null ? (
                    'Todavía no hay variación suficiente para sacar una conclusión.'
                  ) : energyCorrelation > 0.35 ? (
                    <>
                      Cuando dormís más, arrancás con más energía —{' '}
                      <strong className="text-ink">correlación {energyCorrelation.toFixed(2)}</strong>.
                    </>
                  ) : energyCorrelation < -0.35 ? (
                    <>
                      Curiosamente dormir más te está dando <em>menos</em> energía (
                      {energyCorrelation.toFixed(2)}). Suele pasar cuando se duerme de más para
                      compensar.
                    </>
                  ) : (
                    <>
                      No hay relación clara entre cuánto dormís y tu energía (
                      {energyCorrelation.toFixed(2)}). Probablemente pesen más otras cosas.
                    </>
                  )}
                </p>

                <div className="mt-4 flex items-end gap-1" style={{ height: 90 }}>
                  {energyPoints.slice(-30).map((point) => (
                    <div key={point.date} className="flex h-full flex-1 flex-col justify-end gap-0.5">
                      <div
                        title={`${fmt(point.date, 'd MMM')}: ${formatMinutes(point.asleepMinutes)}, energía ${point.energy}/5`}
                        className="w-full rounded-t-[2px] bg-ramp-3"
                        style={{ height: `${(point.asleepMinutes / 600) * 100}%` }}
                      />
                      <div
                        className="w-full rounded-b-[2px] bg-accent"
                        style={{ height: `${(point.energy / 5) * 30}%` }}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-faint">
                  Barra clara: horas dormidas. Barra naranja abajo: energía que cargaste esa mañana.
                </p>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ------------------------------------------------ Importar y ajustes */}
      <Card className="mt-4">
        <SectionTitle>Traer datos del Apple Watch</SectionTitle>
        <p className="mt-1 text-sm text-ink-muted">
          En el iPhone: <strong className="text-ink">Salud → tu foto → Exportar todos los datos
          de salud</strong>. Descomprimí el ZIP y subí acá el archivo{' '}
          <code className="text-accent">export.xml</code>.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={progress !== null}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="size-4" />
            {progress ? 'Importando…' : 'Importar export.xml'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onImport(file)
              e.target.value = ''
            }}
          />

          <div className="flex items-center gap-2">
            <Label htmlFor="target" className="mb-0">
              Objetivo
            </Label>
            <Input
              id="target"
              type="number"
              min={240}
              max={720}
              step={15}
              className="w-24"
              value={target}
              onChange={(e) =>
                updateProfile({ sleepTargetMinutes: Number(e.target.value) || 480 })
              }
            />
            <span className="text-xs text-ink-faint">min</span>
          </div>
        </div>

        {progress ? (
          <div className="mt-4">
            <ProgressBar value={(progress.bytesRead / progress.totalBytes) * 100} />
            <p className="mt-1.5 text-xs text-ink-faint tabular-nums">
              {Math.round(progress.bytesRead / 1024 / 1024)} de{' '}
              {Math.round(progress.totalBytes / 1024 / 1024)} MB · {progress.segments} segmentos
            </p>
          </div>
        ) : null}

        {importMessage ? <p className="mt-3 text-sm text-positive">{importMessage}</p> : null}
        {importError ? <p className="mt-3 text-sm text-negative">{importError}</p> : null}

        <Panel className="mt-4 flex gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" />
          <p className="text-xs text-ink-muted">
            El export trae todo tu historial de salud, así que puede pesar cientos de MB. Se lee por
            partes y sólo se extraen los registros de sueño: nada del resto sale de tu navegador.
          </p>
        </Panel>
      </Card>

      {/* ---------------------------------------------------- Últimas noches */}
      {hasData ? (
        <Card className="mt-4">
          <SectionTitle>Noches registradas</SectionTitle>
          <ul className="mt-3 divide-y divide-line">
            {Object.values(data.sleep)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 10)
              .map((night) => (
                <li key={night.date} className="group flex items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 text-sm text-ink-muted">
                    {capitalize(fmt(night.date, 'EEE d MMM'))}
                  </span>
                  <StageBar night={night} className="h-2 flex-1" />
                  <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums">
                    {formatMinutes(night.asleepMinutes)}
                  </span>
                  <span className="w-16 shrink-0 text-right text-[11px] text-ink-faint">
                    {night.source === 'shortcut'
                      ? 'Atajo'
                      : night.source === 'import'
                        ? 'Salud'
                        : 'Manual'}
                  </span>
                  <IconButton
                    label={`Eliminar noche del ${night.date}`}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => removeSleepNight(night.date)}
                  >
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      <ManualNightModal
        night={manual}
        onClose={() => setManual(null)}
        onSave={(night) => {
          upsertSleepNight(night)
          setManual(null)
        }}
      />
    </>
  )
}

interface ManualNightModalProps {
  night: SleepNight | null
  onClose: () => void
  onSave: (night: SleepNight) => void
}

function ManualNightModal({ night, onClose, onSave }: ManualNightModalProps) {
  const [date, setDate] = useState('')
  const [bed, setBed] = useState('')
  const [wake, setWake] = useState('')
  const [awake, setAwake] = useState(0)

  // Sincroniza los campos cuando se abre con una noche nueva.
  const openedFor = useRef<string | null>(null)
  if (night && openedFor.current !== night.date) {
    openedFor.current = night.date
    setDate(night.date)
    setBed(fmt(new Date(night.bedtime), 'HH:mm'))
    setWake(fmt(new Date(night.wakeTime), 'HH:mm'))
    setAwake(night.stages.awake)
  }
  if (!night && openedFor.current !== null) openedFor.current = null

  function save() {
    const wakeAt = new Date(`${date}T${wake}:00`)
    let bedAt = new Date(`${date}T${bed}:00`)
    // Si te acostaste después de la hora en que te levantaste, fue el día anterior.
    if (bedAt >= wakeAt) bedAt = subDays(bedAt, 1)

    const inBed = Math.round((wakeAt.getTime() - bedAt.getTime()) / 60_000)
    const asleep = Math.max(0, inBed - awake)

    onSave({
      date,
      bedtime: bedAt.toISOString(),
      wakeTime: wakeAt.toISOString(),
      inBedMinutes: inBed,
      asleepMinutes: asleep,
      stages: { awake, rem: 0, core: 0, deep: 0, unspecified: asleep },
      source: 'manual',
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <Modal
      open={night !== null}
      onClose={onClose}
      title="Cargar una noche"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!date || !bed || !wake} onClick={save}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div>
          <Label htmlFor="m-date">Mañana en que te despertaste</Label>
          <Input id="m-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="m-bed">Me acosté</Label>
            <Input id="m-bed" type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="m-wake">Me levanté</Label>
            <Input id="m-wake" type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="m-awake">Minutos despierto durante la noche</Label>
          <Input
            id="m-awake"
            type="number"
            min={0}
            max={480}
            value={awake}
            onChange={(e) => setAwake(Number(e.target.value) || 0)}
          />
        </div>
        <p className="text-xs text-ink-faint">
          La carga manual no tiene fases: el reloj es el único que las mide.
        </p>
      </div>
    </Modal>
  )
}
