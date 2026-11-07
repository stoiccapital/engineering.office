import type {
  MonthValues,
  Umsatzkontrolle,
  UmsatzTeam,
  UmsatzTeamView,
  Ziele,
  ZieleBranch,
  ZieleTeam,
} from '@/types'
import { emptyMonthValues } from '@/types'
import { computeTeamTargets, teamFTE } from '@/ziele-store'

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
] as const

export const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'] as const

// Calendar quarter for a given date (defaults to today). Returns 'Q1'..'Q4'.
export function currentCalendarQuarter(date: Date = new Date()): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  return QUARTER_LABELS[Math.floor(date.getMonth() / 3)]
}

// Column indices for quarter boundaries so we can lay out a 12-month grid with
// Q totals inlined after Mar/Jun/Sep/Dec.
export const QUARTER_END_MONTH_INDEX = [2, 5, 8, 11] as const

export function quarterSum(values: MonthValues, q: 0 | 1 | 2 | 3): number {
  const start = q * 3
  return (
    (values[start] ?? 0) + (values[start + 1] ?? 0) + (values[start + 2] ?? 0)
  )
}

export function totalSum(values: MonthValues): number {
  return values.reduce<number>((s, v) => s + (v ?? 0), 0)
}

export function addMonthValues(a: MonthValues, b: MonthValues): MonthValues {
  return Array.from({ length: 12 }, (_, i) => {
    const av = a[i]
    const bv = b[i]
    if (av === null && bv === null) return null
    return (av ?? 0) + (bv ?? 0)
  })
}

export function subMonthValues(a: MonthValues, b: MonthValues): MonthValues {
  return Array.from({ length: 12 }, (_, i) => {
    const av = a[i]
    const bv = b[i]
    if (av === null && bv === null) return null
    return (av ?? 0) - (bv ?? 0)
  })
}

export function cumulativeMonthValues(values: MonthValues): MonthValues {
  const out: MonthValues = []
  let acc = 0
  for (let i = 0; i < 12; i++) {
    acc += values[i] ?? 0
    out.push(acc)
  }
  return out
}

// Monthly target from Ziele: H1 months (Jan–Jun) use the H1 rate × H1 FTE,
// H2 months (Jul–Dez) use the H2 rate × H2 FTE. Effective FTE includes the
// team's share of Verwaltung + Ausschreibung via its Teilungsschlüssel, so
// Zielkontrolle mirrors the Ziele formula exactly.
export function monthlyZielFromZiele(team: ZieleTeam, branch: ZieleBranch): MonthValues {
  const targets = computeTeamTargets(team, branch)
  const h1Monthly = targets.umsatz.h1.monat
  const h2Monthly = targets.umsatz.h2.monat
  if (h1Monthly === 0 && h2Monthly === 0) return emptyMonthValues()
  return Array.from({ length: 12 }, (_, i) => (i < 6 ? h1Monthly : h2Monthly))
}

// Merge Ziele (source of teams + targets) with Umsatzkontrolle (forecast + rechnungen).
// Teams come from Ziele; operational numbers are matched by id (post-migration).
export function mergeUmsatz(
  ziele: Ziele | null,
  umsatz: Umsatzkontrolle | null,
): UmsatzTeamView[] {
  if (!ziele) return []
  const umsatzById = new Map<string, UmsatzTeam>()
  for (const t of umsatz?.teams ?? []) umsatzById.set(t.id, t)
  const views: UmsatzTeamView[] = []
  for (const branch of ziele.branches) {
    for (const team of branch.teams) {
      const u = umsatzById.get(team.id)
      views.push({
        id: team.id,
        name: team.name,
        branch: branch.id,
        fte: teamFTE(team),
        forecast: u?.forecast ?? emptyMonthValues(),
        rechnungen: u?.rechnungen ?? emptyMonthValues(),
        ziel: monthlyZielFromZiele(team, branch),
      })
    }
  }
  return views
}

// One-time migration: legacy UmsatzTeam carried its own name/branch/fte/ziel.
// Match by normalized name to a Ziele team and rewrite its id. Drop unmatched.
type LegacyUmsatzTeam = UmsatzTeam & { name?: string; branch?: string; fte?: number; ziel?: MonthValues }

export function migrateUmsatz(raw: Umsatzkontrolle | null, ziele: Ziele | null): Umsatzkontrolle | null {
  if (!raw) return raw
  if (!ziele) return raw
  const zieleById = new Set<string>()
  const zieleByName = new Map<string, string>()
  for (const b of ziele.branches) {
    for (const t of b.teams) {
      zieleById.add(t.id)
      zieleByName.set(normalizeName(t.name), t.id)
    }
  }
  const migrated: UmsatzTeam[] = []
  const seen = new Set<string>()
  for (const raw_ of raw.teams) {
    const t = raw_ as LegacyUmsatzTeam
    let targetId: string | null = null
    if (zieleById.has(t.id)) targetId = t.id
    else if (t.name) targetId = zieleByName.get(normalizeName(t.name)) ?? null
    if (!targetId || seen.has(targetId)) continue
    seen.add(targetId)
    migrated.push({
      id: targetId,
      forecast: t.forecast,
      rechnungen: t.rechnungen,
    })
  }
  return { year: raw.year, teams: migrated }
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase()
}
