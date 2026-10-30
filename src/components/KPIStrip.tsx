import { useMemo } from 'react'
import { useForecast } from '@/store'
import { derive } from '@/types'
import { fmtEUR } from '@/lib/format'
import { KPICard, KPIGrid } from '@/components/ui/kpi-card'

export function KPIStrip() {
  const period = useForecast((s) => s.period)
  const rows = period?.rows ?? []

  const k = useMemo(() => {
    let deBereinigtSumme = 0
    let deBereinigtKritisch = 0
    let deBereinigtWahrscheinlich = 0
    let plSumme = 0
    let plKritisch = 0
    let plWahrscheinlich = 0
    for (const r of rows) {
      const d = derive(r)
      const deB = d.forecastDEBereinigt ?? 0
      const pl = r.forecastPL ?? 0
      deBereinigtSumme += deB
      plSumme += pl
      if (r.flagDE === 'k') deBereinigtKritisch += deB
      else deBereinigtWahrscheinlich += deB
      if (r.flagPL === 'k') plKritisch += pl
      else plWahrscheinlich += pl
    }
    return {
      deBereinigtSumme,
      deBereinigtKritisch,
      deBereinigtWahrscheinlich,
      plSumme,
      plKritisch,
      plWahrscheinlich,
    }
  }, [rows])

  return (
    <KPIGrid cols={6}>
      <KPICard label="DE bereinigt Summe" value={fmtEUR(k.deBereinigtSumme)} unit="€" />
      <KPICard
        label="DE bereinigt wahrscheinlich"
        value={fmtEUR(k.deBereinigtWahrscheinlich)}
        unit="€"
      />
      <KPICard
        label="DE bereinigt kritisch"
        value={fmtEUR(k.deBereinigtKritisch)}
        unit="€"
        tone="danger"
      />
      <KPICard label="Forecast Polen Summe" value={fmtEUR(k.plSumme)} unit="€" />
      <KPICard
        label="Forecast Polen wahrscheinlich"
        value={fmtEUR(k.plWahrscheinlich)}
        unit="€"
      />
      <KPICard
        label="Forecast Polen kritisch"
        value={fmtEUR(k.plKritisch)}
        unit="€"
        tone="danger"
      />
    </KPIGrid>
  )
}
