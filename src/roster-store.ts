import { create } from 'zustand'
import {
  emptyRoster,
  type Roster,
  type RosterEmployee,
  type RosterLocation,
  type RosterTeam,
} from './types'
import { fetchRoster, saveRoster } from './api'
import { createAutosave } from './lib/autosave'
import { logActivity } from '@/activity-store'

function log(action: string, target?: string) {
  logActivity({ kind: 'action', module: 'mitarbeiter', action, target })
}

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  roster: Roster | null
  status: SaveStatus
  error: string | null
  load: () => Promise<void>
  addLocation: (name?: string) => void
  updateLocation: (id: string, patch: Partial<Omit<RosterLocation, 'id'>>) => void
  removeLocation: (id: string) => void
  addTeam: (name?: string, locationId?: string) => void
  updateTeam: (id: string, patch: Partial<Omit<RosterTeam, 'id'>>) => void
  removeTeam: (id: string) => void
  addEmployee: (teamId?: string) => void
  updateEmployee: (id: string, patch: Partial<Omit<RosterEmployee, 'id'>>) => void
  removeEmployee: (id: string) => void
  // Clear kuerzel / password / personalnummer / roleId on every employee
  // except the one whose id matches `exceptId` (used to keep the currently
  // signed-in admin functional while wiping everyone else's login).
  clearAllLogins: (exceptId?: string) => void
}


function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export const useRoster = create<State>()((set, get) => {
  const autosave = createAutosave<Roster>({
    save: async (roster, mode) => {
      if (mode === 'keepalive') {
        await saveRoster(roster, { keepalive: true })
        return
      }
      try {
        await saveRoster(roster)
        set({ status: 'saved', error: null })
      } catch (e) {
        set({ status: 'error', error: (e as Error).message })
      }
    },
  })
  function scheduleSave() {
    const s = get()
    if (!s.roster) return
    set({ status: 'saving' })
    autosave.schedule(s.roster)
  }
  return {
  roster: null,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const data = await fetchRoster()
      // Migration: older rosters may be missing the locations array.
      const safe: Roster = data
        ? { locations: data.locations ?? [], teams: data.teams ?? [], employees: data.employees ?? [] }
        : emptyRoster()
      set({ roster: safe, status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  addLocation: (name = '') => {
    const s = get()
    if (!s.roster) return
    const loc: RosterLocation = { id: newId(), name }
    set({ roster: { ...s.roster, locations: [...s.roster.locations, loc] } })
    log('location.add', name || loc.id)
    scheduleSave()
  },

  updateLocation: (id, patch) => {
    const s = get()
    if (!s.roster) return
    set({
      roster: {
        ...s.roster,
        locations: s.roster.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      },
    })
    log(`location.update.${Object.keys(patch).join(',') || 'any'}`, id)
    scheduleSave()
  },

  removeLocation: (id) => {
    const s = get()
    if (!s.roster) return
    const removed = s.roster.locations.find((l) => l.id === id)
    set({
      roster: {
        ...s.roster,
        locations: s.roster.locations.filter((l) => l.id !== id),
        teams: s.roster.teams.map((t) =>
          t.locationId === id ? { ...t, locationId: undefined } : t,
        ),
      },
    })
    log('location.remove', removed?.name ?? id)
    scheduleSave()
  },

  addTeam: (name = '', locationId) => {
    const s = get()
    if (!s.roster) return
    const team: RosterTeam = { id: newId(), name, locationId }
    set({ roster: { ...s.roster, teams: [...s.roster.teams, team] } })
    log('team.add', name || team.id)
    scheduleSave()
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
    log(`team.update.${Object.keys(patch).join(',') || 'any'}`, id)
    scheduleSave()
  },

  removeTeam: (id) => {
    const s = get()
    if (!s.roster) return
    const removed = s.roster.teams.find((t) => t.id === id)
    set({
      roster: {
        ...s.roster,
        teams: s.roster.teams.filter((t) => t.id !== id),
        employees: s.roster.employees.map((e) =>
          e.teamId === id ? { ...e, teamId: undefined } : e,
        ),
      },
    })
    log('team.remove', removed?.name ?? id)
    scheduleSave()
  },

  addEmployee: (teamId) => {
    const s = get()
    if (!s.roster) return
    const emp: RosterEmployee = { id: newId(), vorname: '', name: '', teamId }
    set({ roster: { ...s.roster, employees: [...s.roster.employees, emp] } })
    log('employee.add', emp.id)
    scheduleSave()
  },

  updateEmployee: (id, patch) => {
    const s = get()
    if (!s.roster) return
    const target = s.roster.employees.find((e) => e.id === id)
    set({
      roster: {
        ...s.roster,
        employees: s.roster.employees.map((e) =>
          e.id === id ? { ...e, ...patch } : e,
        ),
      },
    })
    // Separate action for password changes so admins can audit them explicitly.
    const label =
      target && target.kuerzel
        ? `${target.vorname} ${target.name} (${target.kuerzel})`
        : id
    if (Object.hasOwn(patch, 'password')) log('employee.password.set', label)
    else log(`employee.update.${Object.keys(patch).join(',') || 'any'}`, label)
    scheduleSave()
  },

  removeEmployee: (id) => {
    const s = get()
    if (!s.roster) return
    const removed = s.roster.employees.find((e) => e.id === id)
    set({
      roster: {
        ...s.roster,
        employees: s.roster.employees.filter((e) => e.id !== id),
      },
    })
    log(
      'employee.remove',
      removed ? `${removed.vorname} ${removed.name}` : id,
    )
    scheduleSave()
  },

  clearAllLogins: (exceptId) => {
    const s = get()
    if (!s.roster) return
    set({
      roster: {
        ...s.roster,
        employees: s.roster.employees.map((e) =>
          e.id === exceptId
            ? e
            : { ...e, kuerzel: undefined, password: undefined, personalnummer: undefined, roleId: undefined },
        ),
      },
    })
    log('employee.logins.clear.all', exceptId ? `except ${exceptId}` : undefined)
    scheduleSave()
  },
  }
})
