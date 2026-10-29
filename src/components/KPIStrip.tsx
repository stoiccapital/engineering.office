import { useMemo } from 'react'
import { useForecast } from '@/store'
import { derive } from '@/types'
import { fmtEUR, fmtPct } from '@/lib/format'
import { KPICard, KPIGrid } from '@/components/ui/kpi-card'

export function KPIStrip() {
  const period = useForecast((s) => s.period)
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
    return { forecastDEBereinigt, gewichtetDE, share, kritisch, wahrscheinlich }
  }, [rows])

  return (
    <KPIGrid>
      <KPICard label="Forecast DE bereinigt" value={fmtEUR(k.forecastDEBereinigt)} unit="€" />
      <KPICard
        label="Gewichtet (Leistungsstand)"
        value={fmtEUR(k.gewichtetDE)}
        unit="€"
        sub={k.share !== null ? fmtPct(k.share) : undefined}
      />
      <KPICard label="Davon kritisch" value={fmtEUR(k.kritisch)} unit="€" tone="danger" />
      <KPICard label="Davon wahrscheinlich" value={fmtEUR(k.wahrscheinlich)} unit="€" />
    </KPIGrid>
  )
}
