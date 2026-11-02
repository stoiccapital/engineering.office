import { cn } from '@/lib/utils'

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'
export type QuarterOrAll = Quarter | 'all'

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4']

type Props = {
  year?: number
  onYearChange?: (year: number) => void
  quarter?: QuarterOrAll
  onQuarterChange?: (q: QuarterOrAll) => void
  includeJahr?: boolean
  className?: string
}

export function PeriodPicker({
  year,
  onYearChange,
  quarter,
  onQuarterChange,
  includeJahr = true,
  className,
}: Props) {
  const showYear = year !== undefined && onYearChange
  const showQuarter = quarter !== undefined && onQuarterChange

  if (!showYear && !showQuarter) return null

  return (
    <div
      className={cn(
        'flex items-center rounded-md border bg-card',
        className,
      )}
    >
      {showYear && (
        <div className="flex items-center gap-1 p-1">
          <button
            onClick={() => onYearChange!(year! - 1)}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Vorheriges Jahr"
            aria-label="Vorheriges Jahr"
          >
            ←
          </button>
          <span className="min-w-[3rem] text-center font-mono text-sm font-semibold tabular-nums">
            {year}
          </span>
          <button
            onClick={() => onYearChange!(year! + 1)}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Nächstes Jahr"
            aria-label="Nächstes Jahr"
          >
            →
          </button>
        </div>
      )}

      {showYear && showQuarter && <div className="h-6 w-px bg-border" />}

      {showQuarter && (
        <div className="flex items-center gap-0.5 p-1">
          {QUARTERS.map((q) => (
            <QuarterPill
              key={q}
              label={q}
              active={quarter === q}
              onClick={() => onQuarterChange!(q)}
            />
          ))}
          {includeJahr && (
            <QuarterPill
              label="Jahr"
              active={quarter === 'all'}
              onClick={() => onQuarterChange!('all')}
            />
          )}
        </div>
      )}
    </div>
  )
}

function QuarterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
