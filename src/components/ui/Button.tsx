import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink font-semibold hover:bg-accent-hover active:bg-accent-press',
  secondary:
    'border border-line-strong bg-surface-2 text-ink hover:border-accent/50 hover:bg-surface-3',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'border border-negative/40 text-negative hover:bg-negative/10',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3.5 text-sm',
  lg: 'h-11 gap-2 px-5 text-sm',
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  size?: Size
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-tile transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}

interface IconButtonProps extends ComponentProps<'button'> {
  label: string
  variant?: Variant
}

export function IconButton({
  label,
  variant = 'ghost',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid size-8 place-items-center rounded-tile transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}
