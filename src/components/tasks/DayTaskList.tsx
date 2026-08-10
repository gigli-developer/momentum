import { useMemo, useState, type FormEvent } from 'react'
import { ChevronRight, ListPlus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import type { ID, ISODate, Task } from '@/lib/types'
import { TaskRow } from './TaskRow'
import { BlockTimeModal } from '@/components/calendar/BlockTimeModal'

interface Branch {
  parent: Task
  children: Task[]
}

/** Agrupa las tareas de un día en árboles de un nivel, ordenados. */
function buildBranches(tasks: Task[], date: ISODate): Branch[] {
  const ofDay = tasks.filter((t) => t.date === date)
  const parents = ofDay.filter((t) => t.parentId === null).sort((a, b) => a.order - b.order)
  return parents.map((parent) => ({
    parent,
    children: ofDay.filter((t) => t.parentId === parent.id).sort((a, b) => a.order - b.order),
  }))
}

interface AddTaskProps {
  onAdd: (title: string) => void
  label?: string
  /** Abre directo en modo input, sin el paso intermedio del botón. */
  autoOpen?: boolean
  onClose?: () => void
}

/** "Agregar tarea" que se despliega en input, como en Google Tasks. */
function AddTask({ onAdd, label = 'Agregar tarea', autoOpen, onClose }: AddTaskProps) {
  const [open, setOpen] = useState(autoOpen ?? false)
  const [value, setValue] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-tile px-1.5 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-surface-2"
      >
        <ListPlus className="size-4" />
        {label}
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="px-1.5 py-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (!value.trim()) {
            setOpen(false)
            onClose?.()
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setValue('')
            setOpen(false)
            onClose?.()
          }
        }}
        placeholder="Escribí y Enter"
        className="w-full rounded-[6px] border border-accent/60 bg-surface-2 px-2 py-1 text-sm text-ink focus:outline-none"
      />
    </form>
  )
}

interface DayTaskListProps {
  date: ISODate
  /** `false` deja la lista de sólo lectura salvo el checkbox. */
  editable?: boolean
  emptyLabel?: string
}

export function DayTaskList({
  date,
  editable = true,
  emptyLabel = 'Sin tareas todavía.',
}: DayTaskListProps) {
  const tasks = useStore((s) => s.tasks)
  const addTask = useStore((s) => s.addTask)
  const toggleTask = useStore((s) => s.toggleTask)
  const toggleTaskStar = useStore((s) => s.toggleTaskStar)
  const updateTask = useStore((s) => s.updateTask)
  const removeTask = useStore((s) => s.removeTask)

  const [showCompleted, setShowCompleted] = useState(false)
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<ID | null>(null)
  const [blocking, setBlocking] = useState<Task | null>(null)

  const branches = useMemo(() => buildBranches(tasks, date), [tasks, date])
  const pending = branches.filter((b) => !b.parent.done)
  const completed = branches.filter((b) => b.parent.done)
  const completedCount = completed.reduce((acc, b) => acc + 1 + b.children.length, 0)

  function renderBranch(branch: Branch) {
    return (
      <div key={branch.parent.id}>
        <ul>
          <TaskRow
            task={branch.parent}
            editable={editable}
            onToggle={() => toggleTask(branch.parent.id)}
            onStar={editable ? () => toggleTaskStar(branch.parent.id) : undefined}
            onAddSubtask={editable ? () => setAddingSubtaskTo(branch.parent.id) : undefined}
            onBlockTime={editable ? () => setBlocking(branch.parent) : undefined}
            onDelete={() => removeTask(branch.parent.id)}
            onUpdate={(patch) => updateTask(branch.parent.id, patch)}
          />
          {branch.children.map((child) => (
            <TaskRow
              key={child.id}
              task={child}
              isSubtask
              editable={editable}
              onToggle={() => toggleTask(child.id)}
              onStar={editable ? () => toggleTaskStar(child.id) : undefined}
              onBlockTime={editable ? () => setBlocking(child) : undefined}
              onDelete={() => removeTask(child.id)}
              onUpdate={(patch) => updateTask(child.id, patch)}
            />
          ))}
        </ul>

        {addingSubtaskTo === branch.parent.id ? (
          <div className="ml-7">
            <AddTask
              autoOpen
              label="Nueva subtarea"
              onClose={() => setAddingSubtaskTo(null)}
              onAdd={(title) => {
                addTask(date, title, branch.parent.id)
                setAddingSubtaskTo(null)
              }}
            />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      {editable ? <AddTask onAdd={(title) => addTask(date, title)} /> : null}

      {branches.length === 0 ? (
        <p className="px-1.5 py-2 text-sm text-ink-faint">{emptyLabel}</p>
      ) : null}

      {pending.map(renderBranch)}

      {completedCount > 0 ? (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            aria-expanded={showCompleted}
            className="flex w-full items-center gap-1.5 rounded-tile px-1.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-2"
          >
            <ChevronRight
              className={cn('size-4 transition-transform', showCompleted && 'rotate-90')}
            />
            Completadas ({completedCount})
          </button>
          {showCompleted ? <div className="mt-0.5">{completed.map(renderBranch)}</div> : null}
        </div>
      ) : null}

      <BlockTimeModal task={blocking} onClose={() => setBlocking(null)} />
    </div>
  )
}
