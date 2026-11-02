import { create } from 'zustand'
import type { MonthValues, Umsatzkontrolle, UmsatzTeam } from './types'
import { emptyMonthValues } from './types'
import { fetchUmsatz, saveUmsatz } from './api'
import { defaultUmsatz } from './lib/seeds'

const CURRENT_YEAR = new Date().getFullYear()

export type MetricKey = 'forecast' | 'rechnungen' | 'ziel'

export type QuarterView = 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  year: number
  quarter: QuarterView
  data: Umsatzkontrolle | null
  status: SaveStatus
  error: string | null
  setYear: (y: number) => void
  setQuarter: (q: QuarterView) => void
  load: () => Promise<void>
  addTeam: () => void
  removeTeam: (id: string) => void
  updateTeam: (
    id: string,
    patch: Partial<Pick<UmsatzTeam, 'name' | 'branch' | 'fte'>>,
  ) => void
  updateCell: (teamId: string, metric: MetricKey, monthIndex: number, value: number | null) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.data) return
    try {
      await saveUmsatz(s.year, s.data)
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function withMonth(values: MonthValues, index: number, value: number | null): MonthValues {
  const next = values.slice()
  next[index] = value
  return next
}

export const useUmsatz = create<State>()((set, get) => ({
  year: CURRENT_YEAR,
  quarter: 'all',
  data: null,
  status: 'idle',
  error: null,

  setYear: (y) => {
    set({ year: y })
    void get().load()
  },

  setQuarter: (q) => set({ quarter: q }),

  load: async () => {
    const s = get()
    set({ status: 'loading', error: null })
    try {
      const data = await fetchUmsatz(s.year)
      set({ data: data ?? defaultUmsatz(s.year), status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  addTeam: () => {
    const s = get()
    if (!s.data) return
    const team: UmsatzTeam = {
      id: newId(),
      name: `Team ${s.data.teams.length + 1}`,
      branch: 'de',
      fte: 1,
      forecast: emptyMonthValues(),
      rechnungen: emptyMonthValues(),
      ziel: emptyMonthValues(),
    }
    set({ data: { ...s.data, teams: [...s.data.teams, team] } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removeTeam: (id) => {
    const s = get()
    if (!s.data) return
    set({ data: { ...s.data, teams: s.data.teams.filter((t) => t.id !== id) } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateTeam: (id, patch) => {
    const s = get()
    if (!s.data) return
    set({
      data: {
        ...s.data,
        teams: s.data.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateCell: (teamId, metric, monthIndex, value) => {
    const s = get()
    if (!s.data) return
    set({
      data: {
        ...s.data,
        teams: s.data.teams.map((t) =>
          t.id === teamId ? { ...t, [metric]: withMonth(t[metric], monthIndex, value) } : t,
        ),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))
