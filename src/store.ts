import { create } from 'zustand'
import type { Period, ProjectRow, Quarter, RiskFlag } from './types'
import { fetchPeriod, savePeriod } from './api'

const CURRENT_YEAR = new Date().getFullYear()

function emptyRow(): ProjectRow {
  return {
    id: crypto.randomUUID(),
    projektleiterDE: '',
    projektleiterPL: '',
    projektname: '',
    projNr: '',
    leistung: '',
    forecastDE: null,
    flagDE: 'w',
    forecastPL: null,
    flagPL: 'w',
    abgerechnetDE: null,
    abgerechnetPL: null,
    leistungsstandDE: null,
    leistungsstandPL: null,
  }
}

function emptyPeriod(year: number, quarter: Quarter): Period {
  return { year, quarter, rows: [emptyRow(), emptyRow(), emptyRow()] }
}

function periodKey(year: number, quarter: Quarter): string {
  return `${year}-${quarter}`
}

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  year: number
  quarter: Quarter
  period: Period | null
  status: SaveStatus
  error: string | null
  setYear: (y: number) => void
  setQuarter: (q: Quarter) => void
  load: () => Promise<void>
  addRow: () => void
  updateRow: (id: string, patch: Partial<ProjectRow>) => void
  deleteRow: (id: string) => void
  setFlag: (id: string, which: 'flagDE' | 'flagPL', flag: RiskFlag) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.period) return
    try {
      await savePeriod(periodKey(s.year, s.quarter), s.period)
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

export const useForecast = create<State>()((set, get) => ({
  year: CURRENT_YEAR,
  quarter: 'Q1',
  period: null,
  status: 'idle',
  error: null,

  setYear: (y) => {
    set({ year: y })
    void get().load()
  },
  setQuarter: (q) => {
    set({ quarter: q })
    void get().load()
  },

  load: async () => {
    const s = get()
    const key = periodKey(s.year, s.quarter)
    set({ status: 'loading', error: null })
    try {
      const data = await fetchPeriod(key)
      set({
        period: data ?? emptyPeriod(s.year, s.quarter),
        status: 'saved',
      })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  addRow: () => {
    const s = get()
    if (!s.period) return
    set({ period: { ...s.period, rows: [...s.period.rows, emptyRow()] } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateRow: (id, patch) => {
    const s = get()
    if (!s.period) return
    set({
      period: {
        ...s.period,
        rows: s.period.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  deleteRow: (id) => {
    const s = get()
    if (!s.period) return
    set({ period: { ...s.period, rows: s.period.rows.filter((r) => r.id !== id) } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  setFlag: (id, which, flag) => {
    const s = get()
    if (!s.period) return
    set({
      period: {
        ...s.period,
        rows: s.period.rows.map((r) => (r.id === id ? { ...r, [which]: flag } : r)),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))
