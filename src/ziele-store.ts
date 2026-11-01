import { create } from 'zustand'
import type { Ziele, ZieleBranch, ZielePerson, ZieleTeam } from './types'
import { fetchZiele, saveZiele } from './api'

const CURRENT_YEAR = new Date().getFullYear()

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  year: number
  ziele: Ziele | null
  status: SaveStatus
  error: string | null
  setYear: (y: number) => void
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
    patch: Partial<Pick<ZielePerson, 'name' | 'fte'>>,
  ) => void
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
  ziele: null,
  status: 'idle',
  error: null,

  setYear: (y) => {
    set({ year: y })
    void get().load()
  },

  load: async () => {
    const s = get()
    set({ status: 'loading', error: null })
    try {
      const data = await fetchZiele(s.year)
      set({ ziele: data, status: 'saved' })
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
}))

// Pure derived math — reused in the view and tests.
export function teamFTE(team: ZieleTeam): number {
  return team.people.reduce((s, p) => s + (p.fte ?? 0), 0)
}

export type TeamTargets = {
  fte: number
  umsatzJahr: number
  umsatzQuartal: number
  umsatzMonat: number
  akquiseJahr: number
  akquiseQuartal: number
  akquiseMonat: number
}

export function computeTeamTargets(team: ZieleTeam, branch: ZieleBranch): TeamTargets {
  const fte = teamFTE(team)
  const umsatzJahr = fte * branch.umsatzProFTE
  const quot = Math.max(0.0001, 1 - branch.ruhendePct)
  const akquiseJahr = umsatzJahr / quot
  return {
    fte,
    umsatzJahr,
    umsatzQuartal: umsatzJahr / 4,
    umsatzMonat: umsatzJahr / 12,
    akquiseJahr,
    akquiseQuartal: akquiseJahr / 4,
    akquiseMonat: akquiseJahr / 12,
  }
}
