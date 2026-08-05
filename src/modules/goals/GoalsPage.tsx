import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Target, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { InlineAdd, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Donut } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import { MIN_GOAL_CATEGORIES, type ID, type Quarter } from '@/lib/types'

const QUARTERS: Quarter[] = [1, 2, 3, 4]
const QUARTER_LABEL: Record<Quarter, string> = {
  1: '1º Trimestre',
  2: '2º Trimestre',
  3: '3º Trimestre',
  4: '4º Trimestre',
}

export function GoalsPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [managing, setManaging] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ID | null>(null)

  const categories = useStore((s) => s.goalCategories)
  const goals = useStore((s) => s.goals)
  const addGoalCategory = useStore((s) => s.addGoalCategory)
  const renameGoalCategory = useStore((s) => s.renameGoalCategory)
  const removeGoalCategory = useStore((s) => s.removeGoalCategory)
  const addGoal = useStore((s) => s.addGoal)
  const toggleGoal = useStore((s) => s.toggleGoal)
  const removeGoal = useStore((s) => s.removeGoal)

  const [activeId, setActiveId] = useState<ID | null>(null)
  // Si la sección activa se borra o todavía no se eligió, cae en la primera.
  const active = categories.find((c) => c.id === activeId) ?? categories[0]

  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id)
  }, [active, activeId])

  const visible = useMemo(
    () => goals.filter((g) => g.categoryId === active?.id && g.year === year),
    [goals, active, year],
  )

  const completed = visible.filter((g) => g.done).length
  const remaining = visible.length - completed
  const toDelete = categories.find((c) => c.id === pendingDelete)
  const toDeleteGoals = goals.filter((g) => g.categoryId === pendingDelete).length

  return (
    <>
      <PageHeader
        icon={<Target className="size-5" />}
        title="Objetivos y metas"
        description="Un objetivo es un compromiso con año y trimestre. Las secciones las armás vos."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* ------------------------------------------------------ Secciones */}
        <div className="flex flex-wrap items-center gap-1 rounded-tile border border-line bg-surface-2 p-1">
          {categories.map((category) => {
            const isActive = category.id === active?.id
            return (
              <div key={category.id} className="flex items-center">
                {managing ? (
                  <div className="flex items-center gap-0.5 rounded-[8px] bg-surface-3 px-1 py-0.5">
                    <Input
                      value={category.label}
                      onChange={(e) => renameGoalCategory(category.id, e.target.value)}
                      onBlur={(e) => {
                        if (!e.target.value.trim()) renameGoalCategory(category.id, 'Sin nombre')
                      }}
                      aria-label={`Nombre de la sección ${category.label}`}
                      className="w-32 border-transparent bg-transparent px-1.5 py-0.5 text-sm"
                    />
                    <IconButton
                      label={`Eliminar sección ${category.label}`}
                      disabled={categories.length <= MIN_GOAL_CATEGORIES}
                      title={
                        categories.length <= MIN_GOAL_CATEGORIES
                          ? 'Tiene que quedar al menos una sección'
                          : `Eliminar ${category.label}`
                      }
                      className="size-6"
                      onClick={() => setPendingDelete(category.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveId(category.id)}
                    aria-pressed={isActive}
                    className={cn(
                      'rounded-[8px] px-3 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-accent font-semibold text-accent-ink'
                        : 'text-ink-muted hover:bg-surface-3 hover:text-ink',
                    )}
                  >
                    {category.label}
                  </button>
                )}
              </div>
            )
          })}

          {managing ? (
            <div className="flex items-center gap-1 pl-1">
              <InlineAdd placeholder="Nueva sección" onAdd={addGoalCategory} className="w-52" />
            </div>
          ) : null}

          <IconButton
            label={managing ? 'Terminar de editar secciones' : 'Editar secciones'}
            className="ml-1 size-8"
            onClick={() => setManaging((v) => !v)}
          >
            {managing ? <X className="size-4" /> : <Pencil className="size-3.5" />}
          </IconButton>
        </div>

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

      {!active ? (
        <Card>
          <p className="text-sm text-ink-muted">
            No hay ninguna sección. Creá una para empezar a cargar objetivos.
          </p>
          <InlineAdd className="mt-3 max-w-sm" placeholder="Ej: Salud" onAdd={addGoalCategory} />
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <SectionTitle>
              {active.label} · {year}
            </SectionTitle>
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
                      {quarterGoals.map((goal) => (
                        <li key={goal.id} className="group flex items-start gap-2">
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
                        </li>
                      ))}
                    </ul>
                  )}

                  <InlineAdd
                    className="mt-auto"
                    placeholder="Nueva meta"
                    onAdd={(title) =>
                      addGoal({ categoryId: active.id, title, year, quarter })
                    }
                  />
                </Card>
              )
            })}
          </div>

          <Panel className="mt-4">
            <p className="text-xs text-ink-muted">
              Las metas se cargan en la sección activa ({active.label}). Con el lápiz de arriba
              podés renombrar, agregar o borrar secciones.
            </p>
          </Panel>
        </>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={`Eliminar “${toDelete?.label ?? ''}”`}
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pendingDelete) removeGoalCategory(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Sí, eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {toDeleteGoals === 0
            ? 'La sección está vacía, no se pierde ningún objetivo.'
            : `Se van a borrar también ${toDeleteGoals} ${toDeleteGoals === 1 ? 'objetivo' : 'objetivos'} de todos los años. No se puede deshacer.`}
        </p>
      </Modal>
    </>
  )
}
