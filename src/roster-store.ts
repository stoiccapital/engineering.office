import { create } from 'zustand'
import {
  emptyRoster,
  type Roster,
  type RosterEmployee,
  type RosterTeam,
} from './types'
import { fetchRoster, saveRoster } from './api'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  roster: Roster | null
  status: SaveStatus
  error: string | null
  load: () => Promise<void>
  addTeam: (name?: string) => void
  updateTeam: (id: string, patch: Partial<Omit<RosterTeam, 'id'>>) => void
  removeTeam: (id: string) => void
  addEmployee: (teamId?: string) => void
  updateEmployee: (id: string, patch: Partial<Omit<RosterEmployee, 'id'>>) => void
  removeEmployee: (id: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.roster) return
    try {
      await saveRoster(s.roster)
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export const useRoster = create<State>()((set, get) => ({
  roster: null,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const data = await fetchRoster()
      set({ roster: data ?? emptyRoster(), status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  addTeam: (name = '') => {
    const s = get()
    if (!s.roster) return
    const team: RosterTeam = { id: newId(), name }
    set({ roster: { ...s.roster, teams: [...s.roster.teams, team] } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateTeam: (id, patch) => {
    const s = get()
    if (!s.roster) return
    set({
      roster: {
        ...s.roster,
        teams: s.roster.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removeTeam: (id) => {
    const s = get()
    if (!s.roster) return
    // Orphan the employees so admin can reassign; don't cascade-delete.
    set({
      roster: {
        ...s.roster,
        teams: s.roster.teams.filter((t) => t.id !== id),
        employees: s.roster.employees.map((e) =>
          e.teamId === id ? { ...e, teamId: undefined } : e,
        ),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  addEmployee: (teamId) => {
    const s = get()
    if (!s.roster) return
    const emp: RosterEmployee = { id: newId(), vorname: '', name: '', teamId }
    set({ roster: { ...s.roster, employees: [...s.roster.employees, emp] } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateEmployee: (id, patch) => {
    const s = get()
    if (!s.roster) return
    set({
      roster: {
        ...s.roster,
        employees: s.roster.employees.map((e) =>
          e.id === id ? { ...e, ...patch } : e,
        ),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removeEmployee: (id) => {
    const s = get()
    if (!s.roster) return
    set({
      roster: {
        ...s.roster,
        employees: s.roster.employees.filter((e) => e.id !== id),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))
