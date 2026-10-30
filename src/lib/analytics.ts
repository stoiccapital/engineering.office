import type { Period, ProjectRow, Quarter } from '@/types'
import { derive } from '@/types'

export const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4']

const UNASSIGNED = 'Ohne Zuordnung'

export type SixMetrics = {
  deBereinigtSumme: number
  deBereinigtWahrscheinlich: number
  deBereinigtKritisch: number
  plSumme: number
  plWahrscheinlich: number
  plKritisch: number
}

export function emptySixMetrics(): SixMetrics {
  return {
    deBereinigtSumme: 0,
    deBereinigtWahrscheinlich: 0,
    deBereinigtKritisch: 0,
    plSumme: 0,
    plWahrscheinlich: 0,
    plKritisch: 0,
  }
}

export function computeSixMetricsSplit(
  deRows: ProjectRow[],
  plRows: ProjectRow[],
): SixMetrics {
  const m = emptySixMetrics()
  for (const r of deRows) {
    const deB = derive(r).forecastDEBereinigt ?? 0
    m.deBereinigtSumme += deB
    if (r.flagDE === 'k') m.deBereinigtKritisch += deB
    else m.deBereinigtWahrscheinlich += deB
  }
  for (const r of plRows) {
    const pl = r.forecastPL ?? 0
    m.plSumme += pl
    if (r.flagPL === 'k') m.plKritisch += pl
    else m.plWahrscheinlich += pl
  }
  return m
}

// Top totals: every row contributes its DE side + its PL side.
export function computeSixMetrics(rows: ProjectRow[]): SixMetrics {
  return computeSixMetricsSplit(rows, rows)
}

export type PMGroup = {
  name: string
  projectCount: number
  metrics: SixMetrics
  deRows: ProjectRow[]
  plRows: ProjectRow[]
}

export type PMProject = {
  row: ProjectRow
  side: 'DE' | 'PL' | 'beide'
}

export function listProjectsForPM(g: PMGroup): PMProject[] {
  const byId = new Map<string, { row: ProjectRow; de: boolean; pl: boolean }>()
  for (const r of g.deRows) {
    byId.set(r.id, { row: r, de: true, pl: false })
  }
  for (const r of g.plRows) {
    const entry = byId.get(r.id)
    if (entry) entry.pl = true
    else byId.set(r.id, { row: r, de: false, pl: true })
  }
  const list: PMProject[] = []
  for (const e of byId.values()) {
    const side: PMProject['side'] = e.de && e.pl ? 'beide' : e.de ? 'DE' : 'PL'
    list.push({ row: e.row, side })
  }
  // Sort by largest contribution first.
  list.sort((a, b) => contrib(b) - contrib(a))
  return list
}

function contrib(p: PMProject): number {
  const d = derive(p.row)
  const deB = d.forecastDEBereinigt ?? 0
  const pl = p.row.forecastPL ?? 0
  if (p.side === 'DE') return deB
  if (p.side === 'PL') return pl
  return deB + pl
}

function hasMoney(r: ProjectRow): boolean {
  return (
    (r.forecastDE ?? 0) !== 0 ||
    (r.forecastPL ?? 0) !== 0 ||
    (r.abgerechnetDE ?? 0) !== 0 ||
    (r.abgerechnetPL ?? 0) !== 0
  )
}

export function groupByProjektleiter(period: Period | null): PMGroup[] {
  if (!period) return []

  // canon → { deRows, plRows, displayCounts }
  type Bucket = {
    canon: string
    deRows: ProjectRow[]
    plRows: ProjectRow[]
    displayCounts: Map<string, number>
  }
  const buckets = new Map<string, Bucket>()

  function bucket(canon: string): Bucket {
    let b = buckets.get(canon)
    if (!b) {
      b = { canon, deRows: [], plRows: [], displayCounts: new Map() }
      buckets.set(canon, b)
    }
    return b
  }
  function tally(b: Bucket, raw: string) {
    b.displayCounts.set(raw, (b.displayCounts.get(raw) ?? 0) + 1)
  }

  for (const r of period.rows) {
    const deRaw = (r.projektleiterDE ?? '').trim()
    const plRaw = (r.projektleiterPL ?? '').trim()

    if (deRaw) {
      const b = bucket(deRaw.toLowerCase())
      b.deRows.push(r)
      tally(b, deRaw)
    }
    if (plRaw) {
      const b = bucket(plRaw.toLowerCase())
      b.plRows.push(r)
      tally(b, plRaw)
    }
    // Row with money but no PM anywhere → Ohne Zuordnung (both sides, since no one owns it).
    if (!deRaw && !plRaw && hasMoney(r)) {
      const b = bucket('__unassigned__')
      b.deRows.push(r)
      b.plRows.push(r)
    }
  }

  const groups: PMGroup[] = []
  for (const b of buckets.values()) {
    const projectIds = new Set<string>()
    for (const r of b.deRows) projectIds.add(r.id)
    for (const r of b.plRows) projectIds.add(r.id)
    const name =
      b.canon === '__unassigned__' ? UNASSIGNED : pickDisplay(b.displayCounts)
    groups.push({
      name,
      projectCount: projectIds.size,
      metrics: computeSixMetricsSplit(b.deRows, b.plRows),
      deRows: b.deRows,
      plRows: b.plRows,
    })
  }

  groups.sort((a, b) => {
    // Ohne Zuordnung always last, regardless of amount.
    if (a.name === UNASSIGNED && b.name !== UNASSIGNED) return 1
    if (b.name === UNASSIGNED && a.name !== UNASSIGNED) return -1
    const sa = a.metrics.deBereinigtSumme + a.metrics.plSumme
    const sb = b.metrics.deBereinigtSumme + b.metrics.plSumme
    return sb - sa
  })
  return groups
}

function pickDisplay(counts: Map<string, number>): string {
  let best = ''
  let bestCount = -1
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}
