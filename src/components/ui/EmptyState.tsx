import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** `inline` para listas cortas dentro de una tarjeta. */
  variant?: 'block' | 'inline'
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  variant = 'block',
}: EmptyStateProps) {
  if (variant === 'inline') {
    return <p className={cn('py-2 text-sm text-ink-faint', className)}>{title}</p>
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-10 text-center',
        className,
      )}
    >
      {icon ? <span className="text-ink-faint">{icon}</span> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
