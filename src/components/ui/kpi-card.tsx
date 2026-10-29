import { cn } from '@/lib/utils'

export function KPICard({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
  tone?: 'danger'
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={cn(
            'font-mono text-2xl font-semibold tabular-nums',
            tone === 'danger' && 'text-destructive',
          )}
        >
          {value || '—'}
        </span>
        {unit && value && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
          {sub}
        </div>
      )}
    </div>
  )
}

export function KPIGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
}
