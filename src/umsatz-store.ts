import { create } from 'zustand'
import type { MonthValues, Umsatzkontrolle, UmsatzTeam } from './types'
import { emptyMonthValues } from './types'
import { fetchUmsatz, saveUmsatz, fetchZiele } from './api'
import { defaultUmsatz } from './lib/seeds'
import { currentCalendarQuarter, migrateUmsatz } from './lib/umsatz'

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_QUARTER = currentCalendarQuarter()

export type MetricKey = 'forecast' | 'rechnungen'

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

function withMonth(values: MonthValues, index: number, value: number | null): MonthValues {
  const next = values.slice()
  next[index] = value
  return next
}

function ensureTeam(data: Umsatzkontrolle, teamId: string): UmsatzTeam {
  const existing = data.teams.find((t) => t.id === teamId)
  if (existing) return existing
  return {
    id: teamId,
    forecast: emptyMonthValues(),
    rechnungen: emptyMonthValues(),
  }
}

export const useUmsatz = create<State>()((set, get) => ({
  year: CURRENT_YEAR,
  quarter: CURRENT_QUARTER,
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
      const [raw, ziele] = await Promise.all([fetchUmsatz(s.year), fetchZiele(s.year)])
      const data = migrateUmsatz(raw ?? defaultUmsatz(s.year), ziele)
      set({ data, status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  updateCell: (teamId, metric, monthIndex, value) => {
    const s = get()
    if (!s.data) return
    const base = ensureTeam(s.data, teamId)
    const updated: UmsatzTeam = { ...base, [metric]: withMonth(base[metric], monthIndex, value) }
    const teams = s.data.teams.some((t) => t.id === teamId)
      ? s.data.teams.map((t) => (t.id === teamId ? updated : t))
      : [...s.data.teams, updated]
    set({ data: { ...s.data, teams } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))
