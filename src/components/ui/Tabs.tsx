import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  /** `full` estira las pestañas a todo el ancho disponible. */
  width?: 'auto' | 'full'
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  width = 'auto',
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex gap-1 rounded-tile border border-line bg-surface-2 p-1',
        width === 'full' && 'flex w-full',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-sm transition-colors',
              width === 'full' && 'flex-1',
              active
                ? 'bg-accent text-accent-ink font-semibold'
                : 'text-ink-muted hover:bg-surface-3 hover:text-ink',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
