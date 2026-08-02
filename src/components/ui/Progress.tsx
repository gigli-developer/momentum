import { cn } from '@/lib/cn'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  color?: string
  /** Altura en px. */
  size?: number
}

export function ProgressBar({ value, max = 100, className, color, size = 6 }: ProgressBarProps) {
  const pct = max === 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('w-full overflow-hidden rounded-full bg-surface-3', className)}
      style={{ height: size }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, backgroundColor: color ?? 'var(--color-accent)' }}
      />
    </div>
  )
}

interface ProgressRingProps {
  /** 0 a 1. */
  progress: number
  size?: number
  stroke?: number
  className?: string
  children?: React.ReactNode
  color?: string
}

export function ProgressRing({
  progress,
  size = 220,
  stroke = 10,
  className,
  children,
  color,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, progress))

  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color ?? 'var(--color-accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 0.4s linear' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

interface DonutProps {
  /** 0 a 1. */
  progress: number
  size?: number
  stroke?: number
  label?: string
}

export function Donut({ progress, size = 56, stroke = 7, label }: DonutProps) {
  return (
    <ProgressRing progress={progress} size={size} stroke={stroke}>
      <span className="text-xs font-semibold text-ink">{label ?? `${Math.round(progress * 100)}%`}</span>
    </ProgressRing>
  )
}

interface SegmentedMeterProps {
  /** Cuántos segmentos están encendidos. */
  value: number
  total: number
  onChange?: (value: number) => void
  className?: string
}

/** Medidor de nivel de energía: N barras discretas, clickeables. */
export function SegmentedMeter({ value, total, onChange, className }: SegmentedMeterProps) {
  return (
    <div className={cn('flex gap-1.5', className)}>
      {Array.from({ length: total }, (_, i) => {
        const on = i < value
        const Tag = onChange ? 'button' : 'div'
        return (
          <Tag
            key={i}
            {...(onChange
              ? {
                  type: 'button' as const,
                  onClick: () => onChange(i + 1),
                  'aria-label': `Nivel ${i + 1} de ${total}`,
                }
              : {})}
            className={cn(
              'h-2 flex-1 rounded-full transition-colors',
              on ? 'bg-accent' : 'bg-surface-3',
              onChange && 'cursor-pointer hover:opacity-80',
            )}
          />
        )
      })}
    </div>
  )
}
