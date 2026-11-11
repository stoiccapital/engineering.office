import { create } from 'zustand'
import {
  annualUmsatzProFTE,
  migrateZiele,
  personFTE,
  type Ziele,
  type ZieleBranch,
  type ZielePerson,
  type ZieleTeam,
} from './types'
import { fetchZiele, saveZiele } from './api'
import { defaultZiele } from './lib/seeds'

const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_HALBJAHR: HalbjahrView =
  new Date().getMonth() < 6 ? 'h1' : 'h2'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

export type HalbjahrView = 'h1' | 'h2' | 'all'

type State = {
  year: number
  halbjahr: HalbjahrView
  ziele: Ziele | null
  status: SaveStatus
  error: string | null
  setYear: (y: number) => void
  setHalbjahr: (h: HalbjahrView) => void
  load: () => Promise<void>
  updateBranch: (branchId: ZieleBranch['id'], patch: Partial<Pick<ZieleBranch, 'umsatzProFTE' | 'ruhendePct'>>) => void
  renameTeam: (branchId: ZieleBranch['id'], teamId: string, name: string) => void
  addTeam: (branchId: ZieleBranch['id']) => void
  removeTeam: (branchId: ZieleBranch['id'], teamId: string) => void
  addPerson: (branchId: ZieleBranch['id'], teamId: string) => void
  removePerson: (branchId: ZieleBranch['id'], teamId: string, personId: string) => void
  updatePerson: (
    branchId: ZieleBranch['id'],
    teamId: string,
    personId: string,
    patch: Partial<Pick<ZielePerson, 'name' | 'fte' | 'role'>>,
  ) => void
  // Edit a single half of a person's FTE (keeps the other half unchanged).
  updatePersonFTE: (
    branchId: ZieleBranch['id'],
    teamId: string,
    personId: string,
    half: 'h1' | 'h2',
    value: number,
  ) => void
  // null = clear override for this bucket (fall back to auto FTE-share).
  updateTeilungsschluessel: (
    branchId: ZieleBranch['id'],
    teamId: string,
    bucket: 'verwaltung' | 'ausschreibung',
    value: number | null,
  ) => void
  lock: (by: string) => void
  unlock: () => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.ziele) return
    try {
      await saveZiele(s.year, s.ziele)
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

function mapBranch(
  z: Ziele,
  branchId: ZieleBranch['id'],
  fn: (b: ZieleBranch) => ZieleBranch,
): Ziele {
  return { ...z, branches: z.branches.map((b) => (b.id === branchId ? fn(b) : b)) }
}

function mapTeam(b: ZieleBranch, teamId: string, fn: (t: ZieleTeam) => ZieleTeam): ZieleBranch {
  return { ...b, teams: b.teams.map((t) => (t.id === teamId ? fn(t) : t)) }
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export const useZiele = create<State>()((set, get) => ({
  year: CURRENT_YEAR,
  halbjahr: INITIAL_HALBJAHR,
  ziele: null,
  status: 'idle',
  error: null,

  setYear: (y) => {
    set({ year: y })
    void get().load()
  },

  setHalbjahr: (h) => set({ halbjahr: h }),

  load: async () => {
    const s = get()
    set({ status: 'loading', error: null })
    try {
      const data = await fetchZiele(s.year)
      const migrated = migrateZiele(data as never) ?? defaultZiele(s.year)
      set({ ziele: migrated, status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  updateBranch: (branchId, patch) => {
    const s = get()
    if (!s.ziele) return
    set({ ziele: mapBranch(s.ziele, branchId, (b) => ({ ...b, ...patch })) })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  renameTeam: (branchId, teamId, name) => {
    const s = get()
    if (!s.ziele) return
    set({
      ziele: mapBranch(s.ziele, branchId, (b) =>
        mapTeam(b, teamId, (t) => ({ ...t, name })),
      ),
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  addTeam: (branchId) => {
    const s = get()
    if (!s.ziele) return
    set({
      ziele: mapBranch(s.ziele, branchId, (b) => ({
        ...b,
        teams: [...b.teams, { id: newId(), name: `Team ${b.teams.length + 1}`, people: [] }],
      })),
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removeTeam: (branchId, teamId) => {
    const s = get()
    if (!s.ziele) return
    set({
      ziele: mapBranch(s.ziele, branchId, (b) => ({
        ...b,
        teams: b.teams.filter((t) => t.id !== teamId),
      })),
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  addPerson: (branchId, teamId) => {
    const s = get()
    if (!s.ziele) return
    set({
      ziele: mapBranch(s.ziele, branchId, (b) =>
        mapTeam(b, teamId, (t) => ({
          ...t,
          people: [...t.people, { id: newId(), name: '', fte: { h1: 1, h2: 1 } }],
        })),
      ),
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removePerson: (branchId, teamId, personId) => {
    const s = get()
    if (!s.ziele) return
    set({
      ziele: mapBranch(s.ziele, branchId, (b) =>
        mapTeam(b, teamId, (t) => ({
          ...t,
          people: t.people.filter((p) => p.id !== personId),
        })),
      ),
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updatePerson: (branchId, teamId, personId, patch) => {
    const s = get()
    if (!s.ziele) return
    set({
      ziele: mapBranch(s.ziele, branchId, (b) =>
        mapTeam(b, teamId, (t) => ({
          ...t,
          people: t.people.map((p) => (p.id === personId ? { ...p, ...patch } : p)),
        })),
      ),
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updatePersonFTE: (branchId, teamId, personId, half, value) => {
    const s = get()
    if (!s.ziele) return
    set({
      ziele: mapBranch(s.ziele, branchId, (b) =>
        mapTeam(b, teamId, (t) => ({
          ...t,
          people: t.people.map((p) =>
            p.id === personId
              ? { ...p, fte: { ...p.fte, [half]: value } }
              : p,
          ),
        })),
      ),
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateTeilungsschluessel: (branchId, teamId, bucket, value) => {
    const s = get()
    if (!s.ziele) return
    set({
      ziele: mapBranch(s.ziele, branchId, (b) =>
        mapTeam(b, teamId, (t) => {
          const current = t.teilungsschluessel ?? {}
          const nextBucket = value === null ? undefined : value
          const next = { ...current, [bucket]: nextBucket }
          if (next.verwaltung === undefined && next.ausschreibung === undefined) {
            return { ...t, teilungsschluessel: undefined }
          }
          return { ...t, teilungsschluessel: next }
        }),
      ),
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  lock: (by) => {
    const s = get()
    if (!s.ziele) return
    set({
      ziele: {
        ...s.ziele,
        locked: true,
        lockedAt: new Date().toISOString(),
        lockedBy: by,
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  unlock: () => {
    const s = get()
    if (!s.ziele) return
    set({
      ziele: {
        ...s.ziele,
        locked: false,
        lockedAt: undefined,
        lockedBy: undefined,
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))

// Pure derived math — reused in the view and tests. All FTE sums accept an
// optional `half` to narrow to H1 or H2; without it they return the annual
// average so legacy callers keep working.
export function teamFTE(team: ZieleTeam, half?: 'h1' | 'h2'): number {
  return team.people.reduce((s, p) => s + personFTE(p, half), 0)
}

// Sum of FTE from people flagged as revenue-producing (role 'team' or missing).
export function teamRevenueFTE(team: ZieleTeam, half?: 'h1' | 'h2'): number {
  return team.people
    .filter((p) => (p.role ?? 'team') === 'team')
    .reduce((s, p) => s + personFTE(p, half), 0)
}

// Sum of FTE from Verwaltung or Ausschreibung people (overhead).
export function teamOverheadFTE(
  team: ZieleTeam,
  role: 'verwaltung' | 'ausschreibung',
  half?: 'h1' | 'h2',
): number {
  return team.people
    .filter((p) => p.role === role)
    .reduce((s, p) => s + personFTE(p, half), 0)
}

export type HalbjahrTargets = {
  halbjahr: number
  quartal: number
  monat: number
}

export type HalfSplit = { h1: number; h2: number }

export type TeamTargets = {
  // Annual-average effective FTE (operative + overhead allocation).
  fte: number
  // Team's own operative FTE per half (sum of role=team people).
  operativeFTE: HalfSplit
  // Allocated Verwaltung + Ausschreibung FTE per half via Teilungsschlüssel.
  overheadFTE: HalfSplit
  // Per-bucket split of the overhead allocation.
  allocatedVerwaltung: HalfSplit
  allocatedAusschreibung: HalfSplit
  // Effective FTE per half (operative + overhead).
  effectiveFTE: HalfSplit
  umsatz: { h1: HalbjahrTargets; h2: HalbjahrTargets; jahr: number }
  akquise: { h1: HalbjahrTargets; h2: HalbjahrTargets; jahr: number }
}

export type BranchAllocations = {
  // Annual-average pools (used for the auto-Teilungsschlüssel default).
  operative: number
  verwaltung: number
  ausschreibung: number
  // Per-half breakdowns (used in the target formula).
  operativeH: HalfSplit
  verwaltungH: HalfSplit
  ausschreibungH: HalfSplit
}

function halbjahr(total: number): HalbjahrTargets {
  return { halbjahr: total, quartal: total / 2, monat: total / 6 }
}

// Sum operative + overhead FTE across the branch per half. Overhead teams
// (where everyone is Verwaltung/Ausschreibung) contribute to the pool but
// don't receive their own targets.
export function computeBranchAllocations(branch: ZieleBranch): BranchAllocations {
  const operativeH: HalfSplit = { h1: 0, h2: 0 }
  const verwaltungH: HalfSplit = { h1: 0, h2: 0 }
  const ausschreibungH: HalfSplit = { h1: 0, h2: 0 }
  for (const t of branch.teams) {
    operativeH.h1 += teamRevenueFTE(t, 'h1')
    operativeH.h2 += teamRevenueFTE(t, 'h2')
    verwaltungH.h1 += teamOverheadFTE(t, 'verwaltung', 'h1')
    verwaltungH.h2 += teamOverheadFTE(t, 'verwaltung', 'h2')
    ausschreibungH.h1 += teamOverheadFTE(t, 'ausschreibung', 'h1')
    ausschreibungH.h2 += teamOverheadFTE(t, 'ausschreibung', 'h2')
  }
  return {
    operative: (operativeH.h1 + operativeH.h2) / 2,
    verwaltung: (verwaltungH.h1 + verwaltungH.h2) / 2,
    ausschreibung: (ausschreibungH.h1 + ausschreibungH.h2) / 2,
    operativeH,
    verwaltungH,
    ausschreibungH,
  }
}

// Effective Teilungsschlüssel for a team + bucket: user override if set, else
// the auto default = this team's annual-average operative share of the branch
// operative pool. Buckets are independent — the Excel model distributes
// Verwaltung and Ausschreibung with separate keys.
export function teamTeilungsschluesselFor(
  team: ZieleTeam,
  allocations: BranchAllocations,
  bucket: 'verwaltung' | 'ausschreibung',
): number {
  const override = team.teilungsschluessel?.[bucket]
  if (override !== undefined) return override
  if (allocations.operative <= 0) return 0
  return teamRevenueFTE(team) / allocations.operative
}

export function computeTeamTargets(team: ZieleTeam, branch: ZieleBranch): TeamTargets {
  const alloc = computeBranchAllocations(branch)
  const tsV = teamTeilungsschluesselFor(team, alloc, 'verwaltung')
  const tsA = teamTeilungsschluesselFor(team, alloc, 'ausschreibung')
  const operativeFTE: HalfSplit = {
    h1: teamRevenueFTE(team, 'h1'),
    h2: teamRevenueFTE(team, 'h2'),
  }
  const allocatedVerwaltung: HalfSplit = {
    h1: alloc.verwaltungH.h1 * tsV,
    h2: alloc.verwaltungH.h2 * tsV,
  }
  const allocatedAusschreibung: HalfSplit = {
    h1: alloc.ausschreibungH.h1 * tsA,
    h2: alloc.ausschreibungH.h2 * tsA,
  }
  const overheadFTE: HalfSplit = {
    h1: allocatedVerwaltung.h1 + allocatedAusschreibung.h1,
    h2: allocatedVerwaltung.h2 + allocatedAusschreibung.h2,
  }
  const effectiveFTE: HalfSplit = {
    h1: operativeFTE.h1 + overheadFTE.h1,
    h2: operativeFTE.h2 + overheadFTE.h2,
  }
  const quot = Math.max(0.0001, 1 - branch.ruhendePct)
  const umsatzH1 = effectiveFTE.h1 * (branch.umsatzProFTE.h1 ?? 0)
  const umsatzH2 = effectiveFTE.h2 * (branch.umsatzProFTE.h2 ?? 0)
  return {
    fte: (effectiveFTE.h1 + effectiveFTE.h2) / 2,
    operativeFTE,
    overheadFTE,
    allocatedVerwaltung,
    allocatedAusschreibung,
    effectiveFTE,
    umsatz: {
      h1: halbjahr(umsatzH1),
      h2: halbjahr(umsatzH2),
      jahr: umsatzH1 + umsatzH2,
    },
    akquise: {
      h1: halbjahr(umsatzH1 / quot),
      h2: halbjahr(umsatzH2 / quot),
      jahr: (umsatzH1 + umsatzH2) / quot,
    },
  }
}

export function emptyTeamTargets(): TeamTargets {
  const z = halbjahr(0)
  return {
    fte: 0,
    operativeFTE: { h1: 0, h2: 0 },
    overheadFTE: { h1: 0, h2: 0 },
    allocatedVerwaltung: { h1: 0, h2: 0 },
    allocatedAusschreibung: { h1: 0, h2: 0 },
    effectiveFTE: { h1: 0, h2: 0 },
    umsatz: { h1: { ...z }, h2: { ...z }, jahr: 0 },
    akquise: { h1: { ...z }, h2: { ...z }, jahr: 0 },
  }
}

export function addTeamTargets(a: TeamTargets, b: TeamTargets): TeamTargets {
  const addH = (x: HalbjahrTargets, y: HalbjahrTargets): HalbjahrTargets => ({
    halbjahr: x.halbjahr + y.halbjahr,
    quartal: x.quartal + y.quartal,
    monat: x.monat + y.monat,
  })
  const addS = (x: HalfSplit, y: HalfSplit): HalfSplit => ({
    h1: x.h1 + y.h1,
    h2: x.h2 + y.h2,
  })
  return {
    fte: a.fte + b.fte,
    operativeFTE: addS(a.operativeFTE, b.operativeFTE),
    overheadFTE: addS(a.overheadFTE, b.overheadFTE),
    allocatedVerwaltung: addS(a.allocatedVerwaltung, b.allocatedVerwaltung),
    allocatedAusschreibung: addS(a.allocatedAusschreibung, b.allocatedAusschreibung),
    effectiveFTE: addS(a.effectiveFTE, b.effectiveFTE),
    umsatz: {
      h1: addH(a.umsatz.h1, b.umsatz.h1),
      h2: addH(a.umsatz.h2, b.umsatz.h2),
      jahr: a.umsatz.jahr + b.umsatz.jahr,
    },
    akquise: {
      h1: addH(a.akquise.h1, b.akquise.h1),
      h2: addH(a.akquise.h2, b.akquise.h2),
      jahr: a.akquise.jahr + b.akquise.jahr,
    },
  }
}

// Branch-level annual umsatz-per-FTE (H1 + H2), used by lib/umsatz.ts.
export function branchAnnualUmsatzProFTE(branch: ZieleBranch): number {
  return annualUmsatzProFTE(branch.umsatzProFTE)
}
