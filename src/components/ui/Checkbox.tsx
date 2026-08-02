import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface CheckboxProps {
  checked: boolean
  onChange: () => void
  label: string
  /** Cuando se pasa, el check usa este color en vez del acento. */
  color?: string
  className?: string
  /** `true` oculta el texto y deja sólo la casilla (grillas densas). */
  hideLabel?: boolean
  disabled?: boolean
}

export function Checkbox({
  checked,
  onChange,
  label,
  color,
  className,
  hideLabel,
  disabled,
}: CheckboxProps) {
  const box = (
    <span
      className={cn(
        'grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-all',
        checked ? 'border-transparent' : 'border-line-strong bg-transparent',
        !checked && !disabled && 'group-hover:border-accent/60',
      )}
      style={checked ? { backgroundColor: color ?? 'var(--color-accent)' } : undefined}
    >
      {checked ? <Check className="size-3 stroke-[3] text-accent-ink" /> : null}
    </span>
  )

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'group flex items-center gap-2.5 text-left transition-opacity',
        disabled && 'pointer-events-none opacity-30',
        className,
      )}
    >
      {box}
      {hideLabel ? null : (
        <span
          className={cn(
            'text-sm transition-colors',
            checked ? 'text-ink-faint line-through' : 'text-ink',
          )}
        >
          {label}
        </span>
      )}
    </button>
  )
}
