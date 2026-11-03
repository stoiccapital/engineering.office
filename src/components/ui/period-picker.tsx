import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ChevronDown } from 'lucide-react'
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
  const [open, setOpen] = useState(false)
  const showYear = year !== undefined && onYearChange
  const showQuarter = quarter !== undefined && onQuarterChange

  if (!showYear && !showQuarter) return null

  const triggerLabel =
    showQuarter && showYear
      ? `${quarter === 'all' ? 'Jahr' : quarter} ${year}`
      : showYear
        ? String(year)
        : quarter === 'all'
          ? 'Jahr'
          : String(quarter)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
        >
          <span className="font-mono tabular-nums font-medium">
            {triggerLabel}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-56 rounded-md border bg-card p-2 text-sm shadow-md focus:outline-none"
        >
          {showYear && (
            <div className="mb-2 flex items-center justify-between rounded-md border px-1 py-1">
              <button
                onClick={() => onYearChange!(year! - 1)}
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Vorheriges Jahr"
              >
                ←
              </button>
              <span className="font-mono tabular-nums text-sm font-semibold">
                {year}
              </span>
              <button
                onClick={() => onYearChange!(year! + 1)}
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Nächstes Jahr"
              >
                →
              </button>
            </div>
          )}

          {showQuarter && (
            <div className="grid grid-cols-2 gap-1">
              {QUARTERS.map((q) => (
                <QuarterChoice
                  key={q}
                  label={q}
                  active={quarter === q}
                  onClick={() => {
                    onQuarterChange!(q)
                    setOpen(false)
                  }}
                />
              ))}
              {includeJahr && (
                <QuarterChoice
                  label="Jahr"
                  active={quarter === 'all'}
                  onClick={() => {
                    onQuarterChange!('all')
                    setOpen(false)
                  }}
                  wide
                />
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function QuarterChoice({
  label,
  active,
  onClick,
  wide,
}: {
  label: string
  active: boolean
  onClick: () => void
  wide?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
        wide && 'col-span-2',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
