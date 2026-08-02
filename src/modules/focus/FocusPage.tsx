import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward, Timer } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { ProgressRing } from '@/components/ui/Progress'
import { Tabs } from '@/components/ui/Tabs'
import { fmt } from '@/lib/date'
import { focusMinutesToday } from '@/lib/stats'
import { snapshot, useStore } from '@/lib/store'
import type { FocusMode } from '@/lib/types'
import { useShallow } from 'zustand/react/shallow'

const MODE_LABEL: Record<FocusMode, string> = {
  focus: 'Enfoque',
  short: 'Descanso corto',
  long: 'Descanso largo',
}

function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Beep corto al terminar el bloque, sin archivos de audio. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 660
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9)
    osc.start()
    osc.stop(ctx.currentTime + 1)
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    /* Sin audio disponible: el bloque termina igual. */
  }
}

export function FocusPage() {
  const settings = useStore((s) => s.focusSettings)
  const updateFocusSettings = useStore((s) => s.updateFocusSettings)
  const logFocusSession = useStore((s) => s.logFocusSession)
  const sessions = useStore((s) => s.focusSessions)
  const data = useStore(useShallow(snapshot))

  const [mode, setMode] = useState<FocusMode>('focus')
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(settings.focus * 60)
  const [label, setLabel] = useState('')
  const [completedBlocks, setCompletedBlocks] = useState(0)

  const total = settings[mode] * 60
  // Ref para que el tick del intervalo no arrastre estado viejo.
  const finishRef = useRef<() => void>(() => {})

  const switchMode = useCallback(
    (next: FocusMode, autostart = false) => {
      setMode(next)
      setRemaining(settings[next] * 60)
      setRunning(autostart)
    },
    [settings],
  )

  finishRef.current = () => {
    chime()
    if (mode === 'focus') {
      logFocusSession(settings.focus, label.trim() || 'Enfoque')
      const blocks = completedBlocks + 1
      setCompletedBlocks(blocks)
      switchMode(blocks % settings.longEvery === 0 ? 'long' : 'short')
    } else {
      switchMode('focus')
    }
  }

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(id)
          finishRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  // El tiempo restante en la pestaña, para no tener que volver a mirar.
  useEffect(() => {
    document.title = running ? `${mmss(remaining)} · ${MODE_LABEL[mode]}` : 'Momentum'
    return () => {
      document.title = 'Momentum'
    }
  }, [remaining, running, mode])

  const minutesToday = focusMinutesToday(data)
  const recent = sessions.slice(0, 6)

  return (
    <>
      <PageHeader
        icon={<Timer className="size-5" />}
        title="Temporizador de enfoque"
        description="Enfocate profundamente en lo que realmente importa."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-col items-center gap-6 py-8">
          <Tabs
            value={mode}
            onChange={(next) => switchMode(next)}
            items={[
              { value: 'focus', label: MODE_LABEL.focus },
              { value: 'short', label: MODE_LABEL.short },
              { value: 'long', label: MODE_LABEL.long },
            ]}
          />

          <ProgressRing progress={total === 0 ? 0 : 1 - remaining / total} size={260} stroke={12}>
            <div className="text-center">
              <p className="text-6xl font-semibold tabular-nums tracking-tight">
                {mmss(remaining)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-faint">
                {MODE_LABEL[mode]}
              </p>
            </div>
          </ProgressRing>

          <div className="flex items-center gap-3">
            <IconButton
              label="Reiniciar"
              variant="secondary"
              className="size-11"
              onClick={() => {
                setRunning(false)
                setRemaining(total)
              }}
            >
              <RotateCcw className="size-4" />
            </IconButton>

            <button
              type="button"
              aria-label={running ? 'Pausar' : 'Iniciar'}
              onClick={() => setRunning((v) => !v)}
              className="grid size-16 place-items-center rounded-full bg-accent text-accent-ink transition-colors hover:bg-accent-hover"
            >
              {running ? (
                <Pause className="size-6 fill-current" />
              ) : (
                <Play className="size-6 translate-x-0.5 fill-current" />
              )}
            </button>

            <IconButton
              label="Saltear bloque"
              variant="secondary"
              className="size-11"
              onClick={() => {
                setRunning(false)
                finishRef.current()
              }}
            >
              <SkipForward className="size-4" />
            </IconButton>
          </div>

          <div className="w-full max-w-sm">
            <Label htmlFor="focus-label">¿En qué te estás enfocando?</Label>
            <Input
              id="focus-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Lanzar landing"
            />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <SectionTitle>Hoy</SectionTitle>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {Math.floor(minutesToday / 60)}h {minutesToday % 60}m
            </p>
            <p className="text-sm text-ink-muted">
              {completedBlocks} {completedBlocks === 1 ? 'bloque' : 'bloques'} en esta sesión
            </p>
          </Card>

          <Card>
            <SectionTitle>Duraciones</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="d-focus">Enfoque</Label>
                <Input
                  id="d-focus"
                  type="number"
                  min={1}
                  max={180}
                  value={settings.focus}
                  onChange={(e) => updateFocusSettings({ focus: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label htmlFor="d-short">Descanso corto</Label>
                <Input
                  id="d-short"
                  type="number"
                  min={1}
                  max={60}
                  value={settings.short}
                  onChange={(e) => updateFocusSettings({ short: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label htmlFor="d-long">Descanso largo</Label>
                <Input
                  id="d-long"
                  type="number"
                  min={1}
                  max={120}
                  value={settings.long}
                  onChange={(e) => updateFocusSettings({ long: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label htmlFor="d-every">Largo cada</Label>
                <Input
                  id="d-every"
                  type="number"
                  min={2}
                  max={12}
                  value={settings.longEvery}
                  onChange={(e) => updateFocusSettings({ longEvery: Number(e.target.value) || 2 })}
                />
              </div>
            </div>
            <Button
              className="mt-3 w-full"
              onClick={() => {
                setRunning(false)
                setRemaining(settings[mode] * 60)
              }}
            >
              Aplicar al bloque actual
            </Button>
          </Card>

          <Card>
            <SectionTitle>Últimos bloques</SectionTitle>
            {recent.length === 0 ? (
              <p className="mt-2 text-sm text-ink-faint">Todavía no completaste ninguno.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {recent.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink">{s.label}</span>
                    <span className="text-xs text-ink-faint tabular-nums">
                      {fmt(new Date(s.finishedAt), 'd MMM · HH:mm')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Panel>
            <p className="text-xs text-ink-muted">
              El temporizador corre mientras la pestaña esté abierta. Si la cerrás, el bloque en
              curso se pierde.
            </p>
          </Panel>
        </div>
      </div>
    </>
  )
}
