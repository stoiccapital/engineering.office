export type RiskFlag = 'k' | 'w' // kritisch | wahrscheinlich

export type ProjectRow = {
  id: string
  projektleiterDE: string
  projektleiterPL: string
  projektname: string
  projNr: string
  leistung: string
  forecastDE: number | null
  flagDE: RiskFlag
  forecastPL: number | null
  flagPL: RiskFlag
  abgerechnetDE: number | null
  abgerechnetPL: number | null
  leistungsstandDE: number | null // 0..1
  leistungsstandPL: number | null // 0..1
}

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export type Period = {
  year: number
  quarter: Quarter
  rows: ProjectRow[]
}

export type PlanStatus = 'abstimmen' | 'urlaub' | 'frei' | 'abgabe'

export const PLAN_STATUSES: PlanStatus[] = ['abstimmen', 'urlaub', 'frei', 'abgabe']

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  abstimmen: 'Abstimmen',
  urlaub: 'Urlaub',
  frei: 'Frei',
  abgabe: 'Abgabe',
}

export type WeekTodo = { id: string; text: string; done: boolean }

export const MAX_TODOS_PER_WEEK = 10

export type QuartalPlan = {
  year: number
  employees: string[]
  cells: Record<string, PlanStatus>
  // Key `${empIndex}:${week}` -> todos for that employee/week cell.
  todos?: Record<string, WeekTodo[]>
}

// Derived values per row
export type Derived = {
  forecastDEBereinigt: number | null // G - I
  abgerechnetDEBereinigt: number | null // M - N
  nochOffenDE: number | null // K - O
  diffPL: number | null // I - N
  gewichtetDE: number | null // K * R
  gewichtetPL: number | null // I * T
}

export function derive(r: ProjectRow): Derived {
  // Business rule: no Forecast DE (0 or empty) → bereinigt is 0, don't subtract PL.
  const noDE = r.forecastDE === 0 || r.forecastDE === null
  const K = noDE ? 0 : sub(r.forecastDE, r.forecastPL)
  const O = sub(r.abgerechnetDE, r.abgerechnetPL)
  return {
    forecastDEBereinigt: K,
    abgerechnetDEBereinigt: O,
    nochOffenDE: sub(K, O),
    diffPL: sub(r.forecastPL, r.abgerechnetPL),
    gewichtetDE: mul(K, r.leistungsstandDE),
    gewichtetPL: mul(r.forecastPL, r.leistungsstandPL),
  }
}

function sub(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null
  return (a ?? 0) - (b ?? 0)
}

function mul(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  return a * b
}
