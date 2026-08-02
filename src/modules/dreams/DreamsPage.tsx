import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Star, Trash2, User } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { InlineAdd } from '@/components/ui/Input'
import { ProgressBar } from '@/components/ui/Progress'
import { Tabs } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import type { Scope } from '@/lib/types'

export function DreamsPage() {
  const [scope, setScope] = useState<Scope>('professional')

  const dreams = useStore((s) => s.dreams)
  const goals = useStore((s) => s.goals)
  const addDream = useStore((s) => s.addDream)
  const toggleDream = useStore((s) => s.toggleDream)
  const removeDream = useStore((s) => s.removeDream)

  const visible = useMemo(() => dreams.filter((d) => d.scope === scope), [dreams, scope])
  const achieved = visible.filter((d) => d.achieved).length

  return (
    <>
      <PageHeader
        icon={<Star className="size-5" />}
        title="Sueños por cumplir"
        description="Un sueño es un destino sin fecha. Los objetivos son los pasos con fecha que te llevan hasta él."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={scope}
          onChange={setScope}
          items={[
            { value: 'personal', label: 'Personales', icon: <User className="size-3.5" /> },
            {
              value: 'professional',
              label: 'Profesionales',
              icon: <Briefcase className="size-3.5" />,
            },
          ]}
        />
        <span className="text-sm text-ink-muted tabular-nums">
          {achieved}/{visible.length} cumplidos
        </span>
      </div>

      <Card>
        {visible.length === 0 ? (
          <EmptyState
            icon={<Star className="size-5" />}
            title="Todavía no cargaste ningún sueño"
            description="Escribilo aunque parezca lejano. Después le colgás objetivos con fecha desde el módulo de Objetivos."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((dream) => {
              const linked = goals.filter((g) => g.dreamId === dream.id)
              const done = linked.filter((g) => g.done).length
              const pct = linked.length === 0 ? 0 : Math.round((done / linked.length) * 100)

              return (
                <li
                  key={dream.id}
                  className={cn(
                    'group rounded-card border p-4 transition-colors',
                    dream.achieved
                      ? 'border-accent/45 bg-accent/[0.06]'
                      : 'border-line bg-surface-2',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="min-w-0 flex-1 items-start"
                      checked={dream.achieved}
                      onChange={() => toggleDream(dream.id)}
                      label={dream.title}
                    />
                    <IconButton
                      label={`Eliminar ${dream.title}`}
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => removeDream(dream.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>

                  <div className="ml-7 mt-2">
                    {linked.length === 0 ? (
                      <Link
                        to="/objetivos"
                        className="text-xs text-ink-faint underline-offset-4 hover:text-accent hover:underline"
                      >
                        Sin objetivos asociados — creá el primero
                      </Link>
                    ) : (
                      <>
                        <div className="mb-1.5 flex items-center justify-between text-xs text-ink-muted">
                          <span>
                            {done}/{linked.length} objetivos cumplidos
                          </span>
                          <span className="tabular-nums">{pct}%</span>
                        </div>
                        <ProgressBar value={pct} size={4} />
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <Panel className="mt-4">
          <SectionTitle className="mb-2">
            Nuevo sueño {scope === 'personal' ? 'personal' : 'profesional'}
          </SectionTitle>
          <InlineAdd
            placeholder="Ej: Vivir un año en otro país"
            onAdd={(title) => addDream(scope, title)}
          />
        </Panel>
      </Card>
    </>
  )
}
