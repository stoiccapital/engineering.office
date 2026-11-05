import { create } from 'zustand'
import {
  annualUmsatzProFTE,
  migrateZiele,
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
          people: [...t.people, { id: newId(), name: '', fte: 1 }],
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

// Pure derived math — reused in the view and tests.
export function teamFTE(team: ZieleTeam): number {
  return team.people.reduce((s, p) => s + (p.fte ?? 0), 0)
}

// Sum of FTE from people flagged as revenue-producing (role 'team' or missing).
export function teamRevenueFTE(team: ZieleTeam): number {
  return team.people
    .filter((p) => (p.role ?? 'team') === 'team')
    .reduce((s, p) => s + (p.fte ?? 0), 0)
}

// Sum of FTE from Verwaltung or Ausschreibung people (overhead).
export function teamOverheadFTE(
  team: ZieleTeam,
  role: 'verwaltung' | 'ausschreibung',
): number {
  return team.people
    .filter((p) => p.role === role)
    .reduce((s, p) => s + (p.fte ?? 0), 0)
}

export type HalbjahrTargets = {
  halbjahr: number
  quartal: number
  monat: number
}

export type TeamTargets = {
  fte: number
  umsatz: { h1: HalbjahrTargets; h2: HalbjahrTargets; jahr: number }
  akquise: { h1: HalbjahrTargets; h2: HalbjahrTargets; jahr: number }
}

function halbjahr(total: number): HalbjahrTargets {
  return { halbjahr: total, quartal: total / 2, monat: total / 6 }
}

export function computeTeamTargets(team: ZieleTeam, branch: ZieleBranch): TeamTargets {
  const fte = teamFTE(team)
  const quot = Math.max(0.0001, 1 - branch.ruhendePct)
  const umsatzH1 = fte * (branch.umsatzProFTE.h1 ?? 0)
  const umsatzH2 = fte * (branch.umsatzProFTE.h2 ?? 0)
  return {
    fte,
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
  return {
    fte: a.fte + b.fte,
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
