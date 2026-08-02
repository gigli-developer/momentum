import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { addDays, subDays } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Sun, Trophy } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { SegmentedMeter } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import { capitalize, fmt, isFuture, toISO, todayISO } from '@/lib/date'
import { recentAchievements } from '@/lib/stats'
import { snapshot, useStore } from '@/lib/store'
import type { RitualEntry } from '@/lib/types'

const ENERGY_LABELS = ['En reserva', 'Baja', 'Estable', 'Buena', 'A pleno']

const BLANK: Omit<RitualEntry, 'date'> = {
  mission: '',
  pillarId: null,
  sapo: '',
  sapoDone: false,
  projectIds: [],
  energy: 3,
  completedAt: null,
}

export function RitualPage() {
  const [cursor, setCursor] = useState(() => new Date())
  const date = toISO(cursor)
  const isToday = date === todayISO()

  const ritual = useStore((s) => s.rituals[date]) ?? { date, ...BLANK }
  const pillars = useStore((s) => s.pillars)
  const projects = useStore((s) => s.projects)
  const updateRitual = useStore((s) => s.updateRitual)
  const toggleRitualProject = useStore((s) => s.toggleRitualProject)
  const completeRitual = useStore((s) => s.completeRitual)
  const data = useStore(useShallow(snapshot))
  const achievements = useMemo(() => recentAchievements(data), [data])

  const pillar = pillars.find((p) => p.id === ritual.pillarId) ?? null
  const activeProjects = projects.filter((p) => !p.archived)

  return (
    <>
      <PageHeader
        icon={<Sun className="size-5" />}
        title="Ritual Matutino"
        description="Empezá el día con intención, claridad y foco."
        action={
          <div className="flex items-center gap-1">
            <IconButton label="Día anterior" onClick={() => setCursor((c) => subDays(c, 1))}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="min-w-32 text-center text-sm text-ink-muted">
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --------------------------------------------------- Misión del día */}
        <Card className="lg:col-span-2">
          <div className="rounded-card bg-accent p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-ink/70">
              Misión de hoy
            </p>
            <input
              value={ritual.mission}
              onChange={(e) => updateRitual(date, { mission: e.target.value })}
              placeholder="¿Cuál es la única cosa que hace que hoy valga la pena?"
              className={cn(
                'mt-2 w-full bg-transparent text-xl font-semibold tracking-tight text-accent-ink',
                'placeholder:text-accent-ink/45 focus:outline-none md:text-2xl',
              )}
            />
          </div>
        </Card>

        {/* ------------------------------------------------------ Pilar de hoy */}
        <Card>
          <SectionTitle>Pilar de hoy</SectionTitle>
          {pillars.length === 0 ? (
            <EmptyState
              className="mt-3"
              title="No definiste pilares"
              description="Los pilares son las 3 o 4 áreas que sostienen tu vida. Se configuran en Ajustes."
            />
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {pillars.map((p) => {
                  const active = p.id === ritual.pillarId
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        updateRitual(date, { pillarId: active ? null : p.id })
                      }
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-tile border px-3 py-1.5 text-sm transition-colors',
                        active
                          ? 'border-accent bg-accent/12 font-medium text-accent'
                          : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                      )}
                    >
                      <span aria-hidden>{p.emoji}</span>
                      {p.name}
                    </button>
                  )
                })}
              </div>

              {pillar ? (
                <Panel className="mt-4">
                  <p className="text-sm text-ink">{pillar.description}</p>
                  <p className="mt-3 text-sm font-medium text-accent">
                    ¿Qué acción mueve hoy mi vida hacia adelante?
                  </p>
                </Panel>
              ) : null}
            </>
          )}

          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <SectionTitle>Nivel de energía</SectionTitle>
              <span className="text-xs text-ink-muted">{ENERGY_LABELS[ritual.energy - 1]}</span>
            </div>
            <SegmentedMeter
              value={ritual.energy}
              total={5}
              onChange={(energy) => updateRitual(date, { energy })}
            />
          </div>
        </Card>

        {/* ----------------------------------------- Proyectos, SAPO y logros */}
        <div className="flex flex-col gap-4">
          <Card>
            <SectionTitle>Proyectos de hoy</SectionTitle>
            {activeProjects.length === 0 ? (
              <EmptyState variant="inline" title="Sin proyectos activos. Agregalos en Ajustes." />
            ) : (
              <div className="mt-3 flex flex-col gap-1.5">
                {activeProjects.map((project) => {
                  const active = ritual.projectIds.includes(project.id)
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => toggleRitualProject(date, project.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-tile border px-3 py-2 text-left text-sm transition-colors',
                        active
                          ? 'border-accent/50 bg-accent/10 text-ink'
                          : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                      )}
                    >
                      <span aria-hidden>{project.emoji}</span>
                      <span className="flex-1 truncate">{project.name}</span>
                      {active ? <Check className="size-4 text-accent" /> : null}
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>Tu SAPO de hoy</SectionTitle>
            <p className="mt-1 text-xs text-ink-faint">
              La tarea que más estás evitando. Hacela primero.
            </p>
            <Input
              className="mt-3"
              value={ritual.sapo}
              onChange={(e) => updateRitual(date, { sapo: e.target.value })}
              placeholder="¿Qué estás postergando?"
            />
            {ritual.sapo ? (
              <Checkbox
                className="mt-3"
                checked={ritual.sapoDone}
                onChange={() => updateRitual(date, { sapoDone: !ritual.sapoDone })}
                label="Me lo comí"
              />
            ) : null}
          </Card>

          <Card>
            <SectionTitle>Logros recientes</SectionTitle>
            {achievements.length === 0 ? (
              <EmptyState variant="inline" title="Todavía no hay logros. Empezá por hoy." />
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {achievements.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2.5 rounded-tile bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span aria-hidden>{a.emoji}</span>
                    <span className="text-ink-muted">{a.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------- Cerrar el ritual */}
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">
                {ritual.completedAt ? 'Ritual completado' : 'Cerrá tu ritual'}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {ritual.completedAt
                  ? `Lo cerraste a las ${fmt(new Date(ritual.completedAt), 'HH:mm')}. Ahora ejecutá.`
                  : 'Cuando tengas misión, pilar y SAPO definidos, dalo por cerrado y arrancá.'}
              </p>
            </div>
            <Button
              variant={ritual.completedAt ? 'secondary' : 'primary'}
              size="lg"
              disabled={!ritual.mission.trim()}
              onClick={() =>
                ritual.completedAt
                  ? updateRitual(date, { completedAt: null })
                  : completeRitual(date)
              }
            >
              {ritual.completedAt ? (
                <>
                  <Trophy className="size-4" /> Reabrir
                </>
              ) : (
                <>
                  <Check className="size-4" /> Completar ritual
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}
