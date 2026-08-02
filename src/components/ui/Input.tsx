import { useState, type ComponentProps, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

const FIELD =
  'w-full rounded-tile border border-line bg-surface-2 px-3 py-2 text-sm text-ink ' +
  'transition-colors hover:border-line-strong focus:border-accent/60 focus:outline-none'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(FIELD, className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(FIELD, 'resize-none leading-relaxed', className)} {...props} />
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(FIELD, 'appearance-none pr-8', className)} {...props} />
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('mb-1.5 block text-xs font-medium text-ink-muted', className)}
      {...props}
    />
  )
}

interface InlineAddProps {
  placeholder: string
  onAdd: (value: string) => void
  className?: string
}

/** Campo "escribí y sumá" — el patrón de alta rápida que usa toda la app. */
export function InlineAdd({ placeholder, onAdd, className }: InlineAddProps) {
  const [value, setValue] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={submit} className={cn('flex items-center gap-2', className)}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={cn(FIELD, 'py-1.5')}
      />
      <button
        type="submit"
        aria-label={placeholder}
        disabled={!value.trim()}
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-tile transition-colors',
          value.trim()
            ? 'bg-accent text-accent-ink hover:bg-accent-hover'
            : 'border border-line text-ink-faint',
        )}
      >
        <Plus className="size-4" />
      </button>
    </form>
  )
}
