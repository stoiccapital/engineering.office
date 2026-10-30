import { usePlan, type QuarterView } from '@/plan-store'
import { cn } from '@/lib/utils'

const OPTIONS: ReadonlyArray<{ value: QuarterView; label: string }> = [
  { value: 'Q1', label: 'Q1' },
  { value: 'Q2', label: 'Q2' },
  { value: 'Q3', label: 'Q3' },
  { value: 'Q4', label: 'Q4' },
  { value: 'all', label: 'Jahr' },
]

export function QuarterSwitcher() {
  const quarter = usePlan((s) => s.quarter)
  const setQuarter = usePlan((s) => s.setQuarter)
  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-card p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setQuarter(o.value)}
          className={cn(
            'rounded px-2 py-1 text-xs font-medium transition-colors',
            quarter === o.value
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
