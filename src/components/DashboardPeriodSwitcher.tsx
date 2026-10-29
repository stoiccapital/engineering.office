import { useDashboard } from '@/dashboard-store'
import type { Quarter } from '@/types'
import { cn } from '@/lib/utils'

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4']

export function DashboardPeriodSwitcher() {
  const year = useDashboard((s) => s.year)
  const quarter = useDashboard((s) => s.quarter)
  const setYear = useDashboard((s) => s.setYear)
  const setQuarter = useDashboard((s) => s.setQuarter)

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 rounded-md border bg-card p-1">
        <button
          onClick={() => setYear(year - 1)}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          title="Vorheriges Jahr"
        >
          ←
        </button>
        <span className="font-mono text-sm font-semibold tabular-nums">{year}</span>
        <button
          onClick={() => setYear(year + 1)}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          title="Nächstes Jahr"
        >
          →
        </button>
      </div>
      <div className="flex rounded-md border bg-card p-1">
        {QUARTERS.map((q) => (
          <button
            key={q}
            onClick={() => setQuarter(q)}
            className={cn(
              'rounded px-3 py-1 text-sm font-medium transition-colors',
              q === quarter
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
