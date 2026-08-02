import { useMemo, useState } from 'react'
import { Briefcase, ChevronLeft, ChevronRight, Target, Trash2, User } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { InlineAdd, Select } from '@/components/ui/Input'
import { Donut } from '@/components/ui/Progress'
import { Tabs } from '@/components/ui/Tabs'
import { useStore } from '@/lib/store'
import type { Quarter, Scope } from '@/lib/types'

const QUARTERS: Quarter[] = [1, 2, 3, 4]
const QUARTER_LABEL: Record<Quarter, string> = {
  1: '1º Trimestre',
  2: '2º Trimestre',
  3: '3º Trimestre',
  4: '4º Trimestre',
}

export function GoalsPage() {
  const [scope, setScope] = useState<Scope>('professional')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [dreamFilter, setDreamFilter] = useState<string>('all')

  const goals = useStore((s) => s.goals)
  const dreams = useStore((s) => s.dreams)
  const addGoal = useStore((s) => s.addGoal)
  const toggleGoal = useStore((s) => s.toggleGoal)
  const removeGoal = useStore((s) => s.removeGoal)

  const scopeDreams = useMemo(() => dreams.filter((d) => d.scope === scope), [dreams, scope])

  const visible = useMemo(
    () =>
      goals.filter(
        (g) =>
          g.scope === scope &&
          g.year === year &&
          (dreamFilter === 'all' ||
            (dreamFilter === 'none' ? g.dreamId === null : g.dreamId === dreamFilter)),
      ),
    [goals, scope, year, dreamFilter],
  )

  const completed = visible.filter((g) => g.done).length
  const remaining = visible.length - completed

  return (
    <>
      <PageHeader
        icon={<Target className="size-5" />}
        title="Objetivos y metas"
        description="Un objetivo es un compromiso con fecha que te acerca a un sueño."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          value={scope}
          onChange={(v) => {
            setScope(v)
            setDreamFilter('all')
          }}
          items={[
            { value: 'personal', label: 'Personal', icon: <User className="size-3.5" /> },
            {
              value: 'professional',
              label: 'Profesional',
              icon: <Briefcase className="size-3.5" />,
            },
          ]}
        />

        <Select
          className="w-auto min-w-56"
          value={dreamFilter}
          onChange={(e) => setDreamFilter(e.target.value)}
          aria-label="Filtrar por sueño"
        >
          <option value="all">Todos los objetivos</option>
          {scopeDreams.map((d) => (
            <option key={d.id} value={d.id}>
              ⭐ {d.title}
            </option>
          ))}
          <option value="none">Sin sueño asociado</option>
        </Select>

        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Año anterior" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <span className="min-w-14 text-center text-sm font-medium tabular-nums">{year}</span>
          <IconButton label="Año siguiente" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
      </div>

      <Card className="mb-4">
        <SectionTitle>Resumen del año</SectionTitle>
        <div className="mt-3 flex items-center gap-5">
          <Donut progress={visible.length === 0 ? 0 : completed / visible.length} size={64} />
          <dl className="grid flex-1 gap-1 text-sm">
            <div className="flex justify-between border-b border-line pb-1">
              <dt className="text-ink-muted">Completados</dt>
              <dd className="font-semibold tabular-nums">{completed}</dd>
            </div>
            <div className="flex justify-between pt-1">
              <dt className="text-ink-muted">Restantes</dt>
              <dd className="font-semibold tabular-nums">{remaining}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {QUARTERS.map((quarter) => {
          const quarterGoals = visible.filter((g) => g.quarter === quarter)
          const quarterDone = quarterGoals.filter((g) => g.done).length

          return (
            <Card key={quarter} className="flex flex-col p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{QUARTER_LABEL[quarter]}</h2>
                <span className="text-xs text-ink-faint tabular-nums">
                  {quarterDone}/{quarterGoals.length}
                </span>
              </div>

              {quarterGoals.length === 0 ? (
                <p className="mb-3 text-sm text-ink-faint">Sin objetivos todavía.</p>
              ) : (
                <ul className="mb-3 flex flex-col gap-2">
                  {quarterGoals.map((goal) => {
                    const dream = dreams.find((d) => d.id === goal.dreamId)
                    return (
                      <li key={goal.id} className="group">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            className="min-w-0 flex-1 items-start"
                            checked={goal.done}
                            onChange={() => toggleGoal(goal.id)}
                            label={goal.title}
                          />
                          <IconButton
                            label={`Eliminar ${goal.title}`}
                            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => removeGoal(goal.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        </div>
                        {dream ? (
                          <p className="ml-7 mt-0.5 truncate text-[11px] text-ink-faint">
                            ⭐ {dream.title}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}

              <InlineAdd
                className="mt-auto"
                placeholder="Nueva meta"
                onAdd={(title) =>
                  addGoal({
                    scope,
                    title,
                    year,
                    quarter,
                    dreamId:
                      dreamFilter === 'all' || dreamFilter === 'none' ? null : dreamFilter,
                  })
                }
              />
            </Card>
          )
        })}
      </div>

      {scopeDreams.length > 0 ? (
        <Panel className="mt-4">
          <p className="text-xs text-ink-muted">
            Elegí un sueño en el filtro de arriba y las metas que cargues van a quedar colgadas de
            ese sueño automáticamente.
          </p>
        </Panel>
      ) : null}
    </>
  )
}
