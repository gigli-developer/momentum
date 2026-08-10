import { useMemo, useState } from 'react'
import { addDays, subDays } from 'date-fns'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Mic,
  MicOff,
  NotebookPen,
  Pause,
  Play,
  Sunrise,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { DayTaskList } from '@/components/tasks/DayTaskList'
import { DayEvents } from '@/components/calendar/DayEvents'
import { useCalendarEvents } from '@/lib/google/calendar'
import { ProgressBar } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import { capitalize, fmt, isFuture, toISO, todayISO } from '@/lib/date'
import { deleteBlob, formatDuration, putBlob } from '@/lib/media'
import { newId } from '@/lib/storage'
import { useStore } from '@/lib/store'
import { RecordingItem } from './RecordingItem'
import { useRecorder } from './useRecorder'

export function JournalPage() {
  const [cursor, setCursor] = useState(() => new Date())
  const date = toISO(cursor)
  const tomorrow = toISO(addDays(cursor, 1))
  const isToday = date === todayISO()

  const tasks = useStore((s) => s.tasks)
  const journal = useStore((s) => s.journal)
  const addJournalRecording = useStore((s) => s.addJournalRecording)
  const removeJournalRecording = useStore((s) => s.removeJournalRecording)
  const toggleJournalClosed = useStore((s) => s.toggleJournalClosed)

  const entry = journal[date]
  const recordings = entry?.recordings ?? []

  const dayTasks = useMemo(() => tasks.filter((t) => t.date === date), [tasks, date])
  const { state: calendar } = useCalendarEvents(date, date)

  const done = dayTasks.filter((t) => t.done).length
  const pct = dayTasks.length === 0 ? 0 : Math.round((done / dayTasks.length) * 100)

  const recorder = useRecorder({
    onFinish: async ({ blob, durationMs, mimeType }) => {
      const id = newId()
      // Primero el blob: si IndexedDB falla, no dejamos metadatos sin audio.
      await putBlob(id, blob)
      addJournalRecording(date, {
        id,
        createdAt: new Date().toISOString(),
        durationMs,
        mimeType,
        size: blob.size,
      })
    },
  })

  async function handleDelete(recordingId: string) {
    await deleteBlob(recordingId).catch(() => {
      /* Si el blob ya no está, igual sacamos el metadato. */
    })
    removeJournalRecording(date, recordingId)
  }

  const busy = recorder.state === 'recording' || recorder.state === 'paused'

  return (
    <>
      <PageHeader
        icon={<NotebookPen className="size-5" />}
        title="Journal"
        description="Marcá qué cumpliste, grabate leyendo lo que escribiste y armá mañana."
        action={
          <div className="flex items-center gap-1">
            <IconButton label="Día anterior" onClick={() => setCursor((c) => subDays(c, 1))}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="min-w-36 text-center text-sm text-ink-muted">
              {isToday ? 'Hoy' : capitalize(fmt(cursor, "EEEE d 'de' MMMM"))}
            </span>
            <IconButton
              label="Día siguiente"
              disabled={isFuture(toISO(addDays(cursor, 1)))}
              onClick={() => setCursor((c) => addDays(c, 1))}
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          {/* ------------------------------------------- 1. Tareas del día */}
          <Card>
            <div className="flex items-baseline justify-between gap-3">
              <SectionTitle>Lo que me puse para hoy</SectionTitle>
              <span className="text-sm text-ink-muted tabular-nums">
                {done}/{dayTasks.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              Son las mismas tareas del planificador semanal. Lo que anotás en el cuaderno va acá.
            </p>

            {dayTasks.length > 0 ? <ProgressBar className="mt-3" value={pct} /> : null}

            <div className="mt-4">
              <DayEvents date={date} state={calendar} variant="full" />
            </div>

            <div className="mt-3">
              <DayTaskList date={date} emptyLabel="No había tareas anotadas para este día." />
            </div>
          </Card>

          {/* ---------------------------------------------- 2. La lectura */}
          <Card>
            <SectionTitle>Tu lectura del día</SectionTitle>
            <p className="mt-1 text-xs text-ink-faint">
              Escribí a mano como siempre, después grabate leyéndolo. El audio queda guardado en
              este día.
            </p>

            <Panel className="mt-4">
              {recorder.state === 'unsupported' ? (
                <p className="text-sm text-ink-muted">
                  Este navegador no permite grabar audio. Probá con Chrome, Edge o Firefox
                  actualizados.
                </p>
              ) : recorder.state === 'denied' ? (
                <div className="flex items-start gap-3">
                  <MicOff className="mt-0.5 size-5 shrink-0 text-negative" />
                  <div>
                    <p className="text-sm font-medium text-ink">Micrófono bloqueado</p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      Habilitalo desde el candado en la barra de direcciones y volvé a intentar.
                    </p>
                    <Button className="mt-3" onClick={() => void recorder.start()}>
                      Reintentar
                    </Button>
                  </div>
                </div>
              ) : busy ? (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'size-2.5 rounded-full bg-negative',
                        recorder.state === 'recording' && 'animate-pulse',
                      )}
                    />
                    <span className="text-2xl font-semibold tabular-nums">
                      {formatDuration(recorder.elapsedMs)}
                    </span>
                    <span className="text-xs uppercase tracking-[0.14em] text-ink-faint">
                      {recorder.state === 'recording' ? 'Grabando' : 'En pausa'}
                    </span>
                  </span>

                  <div className="ml-auto flex items-center gap-2">
                    {recorder.state === 'recording' ? (
                      <Button onClick={recorder.pause}>
                        <Pause className="size-4" /> Pausar
                      </Button>
                    ) : (
                      <Button onClick={recorder.resume}>
                        <Play className="size-4" /> Seguir
                      </Button>
                    )}
                    <Button variant="primary" onClick={recorder.stop}>
                      <CircleStop className="size-4" /> Guardar
                    </Button>
                    <IconButton label="Descartar grabación" onClick={recorder.cancel}>
                      <X className="size-4" />
                    </IconButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink">
                      {recordings.length === 0
                        ? 'Todavía no grabaste nada de este día.'
                        : `${recordings.length} ${recordings.length === 1 ? 'lectura guardada' : 'lecturas guardadas'}.`}
                    </p>
                    {recorder.error ? (
                      <p className="mt-1 text-sm text-negative">{recorder.error}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={recorder.state === 'requesting'}
                    onClick={() => void recorder.start()}
                  >
                    <Mic className="size-4" />
                    {recorder.state === 'requesting' ? 'Pidiendo permiso…' : 'Grabar lectura'}
                  </Button>
                </div>
              )}
            </Panel>

            {recordings.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {recordings.map((recording, i) => (
                  <RecordingItem
                    key={recording.id}
                    recording={recording}
                    date={date}
                    index={i}
                    onDelete={() => void handleDelete(recording.id)}
                  />
                ))}
              </ul>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {/* --------------------------------------------- 3. Cierre del día */}
          <Card>
            <SectionTitle>Cierre del día</SectionTitle>
            {entry?.closedAt ? (
              <p className="mt-2 text-sm text-ink-muted">
                Cerrado a las {fmt(new Date(entry.closedAt), 'HH:mm')}. Podés reabrirlo si te
                quedó algo.
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">
                Cuando tildaste tus tareas y grabaste la lectura, dalo por cerrado.
              </p>
            )}

            <dl className="mt-4 grid gap-1 text-sm">
              <div className="flex justify-between border-b border-line pb-1">
                <dt className="text-ink-muted">Tareas cumplidas</dt>
                <dd className="font-semibold tabular-nums">
                  {done}/{dayTasks.length}
                </dd>
              </div>
              <div className="flex justify-between pt-1">
                <dt className="text-ink-muted">Lecturas grabadas</dt>
                <dd className="font-semibold tabular-nums">{recordings.length}</dd>
              </div>
            </dl>

            <Button
              className="mt-4 w-full"
              variant={entry?.closedAt ? 'secondary' : 'primary'}
              disabled={busy}
              onClick={() => toggleJournalClosed(date)}
            >
              <Check className="size-4" />
              {entry?.closedAt ? 'Reabrir el día' : 'Cerrar el día'}
            </Button>
          </Card>

          {/* ------------------------------------------------ 4. Armá mañana */}
          <Card>
            <div className="flex items-center gap-2">
              <Sunrise className="size-4 text-accent" />
              <SectionTitle>Armá mañana</SectionTitle>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {capitalize(fmt(addDays(cursor, 1), "EEEE d 'de' MMMM"))}
            </p>

            <div className="mt-3">
              <DayTaskList date={tomorrow} emptyLabel="Todavía no anotaste nada." />
            </div>
          </Card>

          <Panel>
            <p className="text-xs text-ink-muted">
              Las grabaciones se guardan en este navegador y{' '}
              <strong className="text-ink">no entran en el backup JSON</strong> de Ajustes. Si te
              importa conservarlas, descargalas con el botón de cada lectura.
            </p>
          </Panel>
        </div>
      </div>
    </>
  )
}
