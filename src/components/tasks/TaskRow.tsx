import { useEffect, useRef, useState } from 'react'
import { CalendarPlus, Check, CornerDownRight, Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Task } from '@/lib/types'

interface TaskRowProps {
  task: Task
  onToggle: () => void
  onStar?: () => void
  onAddSubtask?: () => void
  onBlockTime?: () => void
  onDelete: () => void
  onUpdate?: (patch: Partial<Task>) => void
  /** Las subtareas van indentadas y con un checkbox más chico. */
  isSubtask?: boolean
  /** `false` en vistas de sólo lectura como el panel de mañana. */
  editable?: boolean
}

export function TaskRow({
  task,
  onToggle,
  onStar,
  onAddSubtask,
  onBlockTime,
  onDelete,
  onUpdate,
  isSubtask,
  editable = true,
}: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [note, setNote] = useState(task.note)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) titleRef.current?.focus()
  }, [editing])

  function commit() {
    const trimmed = title.trim()
    // Vaciar el título borraría la tarea sin querer: se revierte al anterior.
    onUpdate?.({ title: trimmed || task.title, note: note.trim() })
    if (!trimmed) setTitle(task.title)
    setEditing(false)
  }

  function cancel() {
    setTitle(task.title)
    setNote(task.note)
    setEditing(false)
  }

  return (
    <li className={cn('group/task', isSubtask && 'ml-7')}>
      <div className="flex items-start gap-2.5 rounded-tile px-1.5 py-1.5 transition-colors hover:bg-surface-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          aria-label={task.title}
          onClick={onToggle}
          className={cn(
            'mt-0.5 grid shrink-0 place-items-center rounded-full border transition-colors',
            isSubtask ? 'size-4' : 'size-[18px]',
            task.done
              ? 'border-transparent bg-accent text-accent-ink'
              : 'border-line-strong hover:border-accent',
          )}
        >
          {task.done ? <Check className={cn(isSubtask ? 'size-2.5' : 'size-3', 'stroke-[3]')} /> : null}
        </button>

        {editing ? (
          <div className="min-w-0 flex-1">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') cancel()
              }}
              className="w-full rounded-[6px] border border-accent/60 bg-surface-2 px-1.5 py-0.5 text-sm text-ink focus:outline-none"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') cancel()
              }}
              placeholder="Agregar detalle"
              className="mt-1 w-full rounded-[6px] border border-line bg-surface-2 px-1.5 py-0.5 text-xs text-ink-muted focus:border-accent/60 focus:outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            disabled={!editable}
            onClick={() => editable && setEditing(true)}
            className="min-w-0 flex-1 text-left"
          >
            <span
              className={cn(
                'block text-sm leading-snug',
                task.done ? 'text-ink-faint line-through' : 'text-ink',
              )}
            >
              {task.title}
            </span>
            {task.note ? (
              <span className="mt-0.5 block text-xs leading-snug text-ink-faint">{task.note}</span>
            ) : null}
          </button>
        )}

        {/* La estrella queda visible si está marcada; el resto sólo en hover. */}
        {!editing ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {onAddSubtask ? (
              <button
                type="button"
                aria-label={`Agregar subtarea a ${task.title}`}
                title="Agregar subtarea"
                onClick={onAddSubtask}
                className="grid size-6 place-items-center rounded-[6px] text-ink-faint opacity-0 transition hover:bg-surface-3 hover:text-ink focus-visible:opacity-100 group-hover/task:opacity-100"
              >
                <CornerDownRight className="size-3.5" />
              </button>
            ) : null}

            {onBlockTime && !task.done ? (
              <button
                type="button"
                aria-label={`Bloquear tiempo para ${task.title}`}
                title="Bloquear tiempo en el calendario"
                onClick={onBlockTime}
                className="grid size-6 place-items-center rounded-[6px] text-ink-faint opacity-0 transition hover:bg-surface-3 hover:text-ink focus-visible:opacity-100 group-hover/task:opacity-100"
              >
                <CalendarPlus className="size-3.5" />
              </button>
            ) : null}

            <button
              type="button"
              aria-label={`Eliminar ${task.title}`}
              title="Eliminar"
              onClick={onDelete}
              className="grid size-6 place-items-center rounded-[6px] text-ink-faint opacity-0 transition hover:bg-surface-3 hover:text-negative focus-visible:opacity-100 group-hover/task:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>

            {onStar ? (
              <button
                type="button"
                aria-label={task.starred ? `Quitar importante a ${task.title}` : `Marcar ${task.title} como importante`}
                aria-pressed={task.starred}
                title="Importante"
                onClick={onStar}
                className={cn(
                  'grid size-6 place-items-center rounded-[6px] transition',
                  task.starred
                    ? 'text-accent'
                    : 'text-ink-faint opacity-0 hover:bg-surface-3 hover:text-ink focus-visible:opacity-100 group-hover/task:opacity-100',
                )}
              >
                <Star className={cn('size-3.5', task.starred && 'fill-current')} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}
