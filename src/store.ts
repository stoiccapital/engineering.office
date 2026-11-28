import { create } from 'zustand'
import type { Period, ProjectRow, Quarter, RiskFlag } from './types'
import { fetchPeriod, savePeriod } from './api'
import { createAutosave } from './lib/autosave'
import { currentCalendarQuarter } from './lib/umsatz'

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_QUARTER: Quarter = currentCalendarQuarter()

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
  replaceRows: (rows: ProjectRow[]) => void
}

export const useForecast = create<State>()((set, get) => {
  const autosave = createAutosave<{ key: string; period: Period }>({
    save: (p, mode) => savePeriod(p.key, p.period, { keepalive: mode === 'keepalive' }),
    onStatus: (status, error) => set({ status, error }),
  })
  function scheduleSave() {
    const s = get()
    if (!s.period) return
    autosave.schedule({ key: periodKey(s.year, s.quarter), period: s.period })
  }
  return {
  year: CURRENT_YEAR,
  quarter: CURRENT_QUARTER,
  period: null,
  status: 'idle',
  error: null,

  setYear: async (y) => {
    await autosave.flush()
    set({ year: y })
    void get().load()
  },
  setQuarter: async (q) => {
    await autosave.flush()
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
    scheduleSave()
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
    scheduleSave()
  },

  deleteRow: (id) => {
    const s = get()
    if (!s.period) return
    set({ period: { ...s.period, rows: s.period.rows.filter((r) => r.id !== id) } })
    scheduleSave()
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
    scheduleSave()
  },

  replaceRows: (rows) => {
    const s = get()
    if (!s.period) return
    set({ period: { ...s.period, rows } })
    scheduleSave()
  },
  }
})
