import type { Period, ProjectRow, Quarter } from '@/types'
import { derive } from '@/types'

export const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4']

const UNASSIGNED = 'ohne'

type Nums = { k: number; o: number; nochOffen: number; forecastRaw: number }

function sumNums(rows: ProjectRow[]): Nums {
  let k = 0
  let o = 0
  let forecastRaw = 0
  for (const r of rows) {
    const d = derive(r)
    k += d.forecastDEBereinigt ?? 0
    o += d.abgerechnetDEBereinigt ?? 0
    forecastRaw += r.forecastDE ?? 0
  }
  return { k, o, nochOffen: k - o, forecastRaw }
}

export type KPI = {
  forecastDE: number
  abgerechnetDE: number
  nochOffenDE: number
  rechnungsquote: number | null
  risikoanteil: number | null
  aktiveProjekte: number
}

export function computeKPI(period: Period | null): KPI {
  if (!period) {
    return {
      forecastDE: 0,
      abgerechnetDE: 0,
      nochOffenDE: 0,
      rechnungsquote: null,
      risikoanteil: null,
      aktiveProjekte: 0,
    }
  }
  const { k, o, nochOffen } = sumNums(period.rows)

  let kritischForecast = 0
  let aktiv = 0
  for (const r of period.rows) {
    const d = derive(r)
    const forecastBer = d.forecastDEBereinigt ?? 0
    if (r.flagDE === 'k') kritischForecast += forecastBer
    const hasActivity =
      (r.forecastDE ?? 0) !== 0 ||
      (r.forecastPL ?? 0) !== 0 ||
      (r.abgerechnetDE ?? 0) !== 0 ||
      (r.abgerechnetPL ?? 0) !== 0
    if (hasActivity) aktiv++
  }

  return {
    forecastDE: k,
    abgerechnetDE: o,
    nochOffenDE: nochOffen,
    rechnungsquote: k > 0 ? o / k : null,
    risikoanteil: k > 0 ? kritischForecast / k : null,
    aktiveProjekte: aktiv,
  }
}

export type QuarterPoint = {
  quarter: Quarter
  forecast: number
  abgerechnet: number
}

export function computeYearCompare(periods: Partial<Record<Quarter, Period | null>>): QuarterPoint[] {
  return QUARTERS.map((q) => {
    const p = periods[q] ?? null
    const { k, o } = p ? sumNums(p.rows) : { k: 0, o: 0 }
    return { quarter: q, forecast: k, abgerechnet: o }
  })
}

export type PLSlice = { name: string; forecast: number; count: number }

export function computePLLoad(period: Period | null, limit = 10): PLSlice[] {
  if (!period) return []
  const groups = new Map<string, { forecast: number; count: number }>()
  for (const r of period.rows) {
    const name = r.projektleiterDE?.trim() || UNASSIGNED
    const d = derive(r)
    const forecast = d.forecastDEBereinigt ?? 0
    if (forecast <= 0) continue
    const g = groups.get(name) ?? { forecast: 0, count: 0 }
    g.forecast += forecast
    g.count += 1
    groups.set(name, g)
  }
  const list = Array.from(groups.entries()).map(([name, g]) => ({ name, ...g }))
  list.sort((a, b) => b.forecast - a.forecast)
  return list.slice(0, limit)
}

export type RiskMix = { kritisch: number; wahrscheinlich: number }

export function computeRiskMix(period: Period | null): RiskMix {
  if (!period) return { kritisch: 0, wahrscheinlich: 0 }
  let kritisch = 0
  let wahrscheinlich = 0
  for (const r of period.rows) {
    const d = derive(r)
    const f = d.forecastDEBereinigt ?? 0
    if (f <= 0) continue
    if (r.flagDE === 'k') kritisch += f
    else wahrscheinlich += f
  }
  return { kritisch, wahrscheinlich }
}

export type RiskPoint = { quarter: Quarter; kritisch: number; wahrscheinlich: number }

export function computeRiskByQuarter(
  periods: Partial<Record<Quarter, Period | null>>,
): RiskPoint[] {
  return QUARTERS.map((q) => {
    const p = periods[q] ?? null
    const mix = computeRiskMix(p)
    return { quarter: q, kritisch: mix.kritisch, wahrscheinlich: mix.wahrscheinlich }
  })
}

export function computeTopOpen(period: Period | null, limit = 10): ProjectRow[] {
  if (!period) return []
  return [...period.rows]
    .map((r) => ({ row: r, open: (derive(r).nochOffenDE ?? 0) }))
    .filter((x) => x.open > 0)
    .sort((a, b) => b.open - a.open)
    .slice(0, limit)
    .map((x) => x.row)
}
