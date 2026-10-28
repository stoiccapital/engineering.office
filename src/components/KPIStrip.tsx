import { useMemo } from 'react'
import { useForecast } from '@/store'
import { derive } from '@/types'
import { fmtEUR, fmtPct } from '@/lib/format'

export function KPIStrip() {
  const period = useForecast((s) => s.periods[`${s.year}-${s.quarter}`])
  const rows = period?.rows ?? []

  const k = useMemo(() => {
    let forecastDEBereinigt = 0
    let abgerechnetDEBereinigt = 0
    let gewichtetDE = 0
    let kritisch = 0
    let wahrscheinlich = 0
    for (const r of rows) {
      const d = derive(r)
      forecastDEBereinigt += d.forecastDEBereinigt ?? 0
      abgerechnetDEBereinigt += d.abgerechnetDEBereinigt ?? 0
      gewichtetDE += d.gewichtetDE ?? 0
      if (r.flagDE === 'k') kritisch += d.forecastDEBereinigt ?? 0
      else wahrscheinlich += d.forecastDEBereinigt ?? 0
    }
    const share = forecastDEBereinigt > 0 ? gewichtetDE / forecastDEBereinigt : null
    const billed = forecastDEBereinigt > 0 ? abgerechnetDEBereinigt / forecastDEBereinigt : null
    return { forecastDEBereinigt, gewichtetDE, share, billed, kritisch, wahrscheinlich }
  }, [rows])

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KPI label="Forecast DE bereinigt" value={fmtEUR(k.forecastDEBereinigt)} unit="€" />
      <KPI label="Gewichtet (Leistungsstand)" value={fmtEUR(k.gewichtetDE)} unit="€" sub={k.share !== null ? fmtPct(k.share) : undefined} />
      <KPI label="Davon kritisch" value={fmtEUR(k.kritisch)} unit="€" tone="danger" />
      <KPI label="Davon wahrscheinlich" value={fmtEUR(k.wahrscheinlich)} unit="€" />
    </div>
  )
}

function KPI({
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
        <span className={`font-mono text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-destructive' : ''}`}>
          {value || '—'}
        </span>
        {unit && value && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">{sub}</div>}
    </div>
  )
}
