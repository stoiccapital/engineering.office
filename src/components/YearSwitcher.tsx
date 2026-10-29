import { usePlan } from '@/plan-store'

export function YearSwitcher() {
  const year = usePlan((s) => s.year)
  const setYear = usePlan((s) => s.setYear)

  return (
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
  )
}
