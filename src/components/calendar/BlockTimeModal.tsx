import { useEffect, useState } from 'react'
import { CalendarPlus, ExternalLink } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select } from '@/components/ui/Input'
import { createCalendarEvent } from '@/lib/google/calendar'
import type { Task } from '@/lib/types'

const DURATIONS = [15, 30, 45, 60, 90, 120]

/** `2026-08-10T09:00:00-03:00` — con el offset local, que Google necesita. */
function toLocalIso(date: string, time: string, addMinutes = 0): string {
  const base = new Date(`${date}T${time}:00`)
  base.setMinutes(base.getMinutes() + addMinutes)
  const pad = (n: number) => String(n).padStart(2, '0')
  const offset = -base.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const oh = pad(Math.floor(Math.abs(offset) / 60))
  const om = pad(Math.abs(offset) % 60)
  return (
    `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}` +
    `T${pad(base.getHours())}:${pad(base.getMinutes())}:00${sign}${oh}:${om}`
  )
}

interface BlockTimeModalProps {
  task: Task | null
  onClose: () => void
}

export function BlockTimeModal({ task, onClose }: BlockTimeModalProps) {
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ link: string | null } | null>(null)

  useEffect(() => {
    if (task) {
      setError(null)
      setCreated(null)
      // Arranca en la próxima hora en punto: es lo que uno suele querer.
      const next = new Date()
      next.setHours(next.getHours() + 1, 0, 0, 0)
      setTime(`${String(next.getHours()).padStart(2, '0')}:00`)
    }
  }, [task])

  async function submit() {
    if (!task) return
    setBusy(true)
    setError(null)
    try {
      const event = await createCalendarEvent({
        summary: task.title,
        note: task.note || undefined,
        start: toLocalIso(task.date, time),
        end: toLocalIso(task.date, time, duration),
      })
      setCreated({ link: event.link })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo crear'
      setError(
        message === 'no_conectado'
          ? 'Conectá tu cuenta de Google desde Ajustes para poder agendar.'
          : message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={task !== null}
      onClose={onClose}
      title="Bloquear tiempo"
      footer={
        created ? (
          <Button variant="primary" onClick={onClose}>
            Listo
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" disabled={busy} onClick={() => void submit()}>
              <CalendarPlus className="size-4" />
              {busy ? 'Agendando…' : 'Agendar'}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div>
          <p className="text-sm text-positive">Listo, quedó en tu calendario.</p>
          {created.link ? (
            <a
              href={created.link}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline"
            >
              Verlo en Google Calendar
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-ink">{task?.title}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="block-time">Empieza</Label>
              <Input
                id="block-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="block-duration">Dura</Label>
              <Select
                id="block-duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <p className="text-xs text-ink-faint">
            Se crea en tu calendario principal, el día de la tarea.
          </p>

          {error ? <p className="text-sm text-negative">{error}</p> : null}
        </div>
      )}
    </Modal>
  )
}
