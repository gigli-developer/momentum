import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'rounded-panel border border-line bg-surface p-5 md:p-6',
        className,
      )}
      {...props}
    />
  )
}

export function Panel({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-card border border-line bg-surface-2 p-4', className)}
      {...props}
    />
  )
}

interface IconTileProps {
  children: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

export function IconTile({ children, size = 'md', className }: IconTileProps) {
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-tile border border-accent/45 bg-accent/10 text-accent',
        size === 'md' ? 'size-12' : 'size-9',
        className,
      )}
    >
      {children}
    </span>
  )
}

interface CardHeaderProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function CardHeader({ icon, title, description, action, className }: CardHeaderProps) {
  return (
    <header className={cn('flex items-start gap-4', className)}>
      {icon ? <IconTile>{icon}</IconTile> : null}
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm leading-snug text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

export function SectionTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint', className)}
      {...props}
    />
  )
}
