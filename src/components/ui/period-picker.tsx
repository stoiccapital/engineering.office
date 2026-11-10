import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'
export type QuarterOrAll = Quarter | 'all'
export type Halbjahr = 'H1' | 'H2'
export type HalbjahrOrAll = Halbjahr | 'all'

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4']
const HALBJAHRE: Halbjahr[] = ['H1', 'H2']
const MONTH_LABELS_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
] as const

type Props = {
  year?: number
  onYearChange?: (year: number) => void
  quarter?: QuarterOrAll
  onQuarterChange?: (q: QuarterOrAll) => void
  halbjahr?: HalbjahrOrAll
  onHalbjahrChange?: (h: HalbjahrOrAll) => void
  month?: number // 1..12
  onMonthChange?: (m: number) => void
  includeJahr?: boolean
  className?: string
}

export function PeriodPicker({
  year,
  onYearChange,
  quarter,
  onQuarterChange,
  halbjahr,
  onHalbjahrChange,
  month,
  onMonthChange,
  includeJahr = true,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const showYear = year !== undefined && onYearChange
  const showQuarter = quarter !== undefined && onQuarterChange
  const showHalbjahr = halbjahr !== undefined && onHalbjahrChange
  const showMonth = month !== undefined && onMonthChange

  if (!showYear && !showQuarter && !showHalbjahr && !showMonth) return null

  const periodLabel = showQuarter
    ? quarter === 'all'
      ? 'Jahr'
      : quarter
    : showHalbjahr
      ? halbjahr === 'all'
        ? 'Jahr'
        : halbjahr
      : showMonth
        ? MONTH_LABELS_SHORT[month - 1]
        : null
  const triggerLabel =
    periodLabel && showYear
      ? `${periodLabel} ${year}`
      : showYear
        ? String(year)
        : (periodLabel ?? '')

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
            <div className="mb-2 space-y-1">
              <div className="flex items-center justify-between rounded-md border px-1 py-1">
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
              <div className="grid grid-cols-4 gap-1">
                {yearChoices(year!).map((y) => (
                  <QuarterChoice
                    key={y}
                    label={String(y)}
                    active={year === y}
                    onClick={() => onYearChange!(y)}
                  />
                ))}
              </div>
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

          {showHalbjahr && (
            <div className="grid grid-cols-2 gap-1">
              {HALBJAHRE.map((h) => (
                <QuarterChoice
                  key={h}
                  label={h}
                  active={halbjahr === h}
                  onClick={() => {
                    onHalbjahrChange!(h)
                    setOpen(false)
                  }}
                />
              ))}
              {includeJahr && (
                <QuarterChoice
                  label="Jahr"
                  active={halbjahr === 'all'}
                  onClick={() => {
                    onHalbjahrChange!('all')
                    setOpen(false)
                  }}
                  wide
                />
              )}
            </div>
          )}

          {showMonth && (
            <div className="grid grid-cols-4 gap-1">
              {MONTH_LABELS_SHORT.map((label, i) => (
                <QuarterChoice
                  key={label}
                  label={label}
                  active={month === i + 1}
                  onClick={() => {
                    onMonthChange!(i + 1)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function yearChoices(current: number): number[] {
  const now = new Date().getFullYear()
  // Default window: this year - 1 .. this year + 6 (8 years, 2 rows of 4).
  // If the picked year is outside, slide the window so it's included.
  let start = now - 1
  let end = now + 6
  if (current < start) start = current
  if (current > end) end = current
  const out: number[] = []
  for (let y = start; y <= end; y++) out.push(y)
  return out
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
