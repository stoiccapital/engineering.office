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
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            'text-xl font-semibold',
            tone === 'danger' && 'text-destructive',
          )}
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {value || '—'}
        </span>
        {unit && value && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {sub && (
        <div
          className="mt-0.5 text-xs text-muted-foreground"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

export function KPIGrid({
  children,
  cols = 4,
}: {
  children: React.ReactNode
  cols?: 3 | 4 | 6 | 7
}) {
  const colsCls =
    cols === 7
      ? 'md:grid-cols-4 xl:grid-cols-7'
      : cols === 6
        ? 'md:grid-cols-3 lg:grid-cols-6'
        : cols === 3
          ? 'md:grid-cols-3'
          : 'md:grid-cols-4'
  return <div className={`grid grid-cols-2 gap-3 ${colsCls}`}>{children}</div>
}
