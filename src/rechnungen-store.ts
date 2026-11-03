import { create } from 'zustand'
import type { Rechnung, RechnungenData, RechnungStatus } from './types'
import { fetchRechnungen, saveRechnungen } from './api'

const CURRENT_YEAR = new Date().getFullYear()

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  year: number
  data: RechnungenData | null
  status: SaveStatus
  error: string | null
  setYear: (y: number) => void
  load: () => Promise<void>
  addRow: () => void
  updateRow: (id: string, patch: Partial<Omit<Rechnung, 'id'>>) => void
  removeRow: (id: string) => void
  setStatus: (id: string, status: RechnungStatus) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.data) return
    try {
      await saveRechnungen(s.year, s.data)
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

function emptyData(year: number): RechnungenData {
  return { year, rows: [] }
}

function nextNr(rows: Rechnung[], year: number): string {
  // Find highest trailing number in R-YYYY-NNN; fall back to length+1
  let max = 0
  const re = new RegExp(`^R-${year}-(\\d{3,})$`)
  for (const r of rows) {
    const m = r.nr?.match(re)
    if (m) max = Math.max(max, Number(m[1]))
  }
  const next = Math.max(max + 1, rows.length + 1)
  return `R-${year}-${String(next).padStart(3, '0')}`
}

export const useRechnungen = create<State>()((set, get) => ({
  year: CURRENT_YEAR,
  data: null,
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
      const data = await fetchRechnungen(s.year)
      set({ data: data ?? emptyData(s.year), status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  addRow: () => {
    const s = get()
    if (!s.data) return
    const today = new Date().toISOString().slice(0, 10)
    const row: Rechnung = {
      id: newId(),
      nr: nextNr(s.data.rows, s.year),
      datum: today,
      kunde: '',
      projekt: '',
      netto: null,
      ustPct: 19,
      status: 'offen',
      faellig: '',
      bezahltAm: '',
      notiz: '',
    }
    set({ data: { ...s.data, rows: [...s.data.rows, row] } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateRow: (id, patch) => {
    const s = get()
    if (!s.data) return
    set({
      data: {
        ...s.data,
        rows: s.data.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removeRow: (id) => {
    const s = get()
    if (!s.data) return
    set({ data: { ...s.data, rows: s.data.rows.filter((r) => r.id !== id) } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  setStatus: (id, status) => {
    const s = get()
    if (!s.data) return
    const bezahltAm = status === 'bezahlt' ? new Date().toISOString().slice(0, 10) : ''
    set({
      data: {
        ...s.data,
        rows: s.data.rows.map((r) =>
          r.id === id ? { ...r, status, bezahltAm: status === 'bezahlt' ? r.bezahltAm || bezahltAm : r.bezahltAm } : r,
        ),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))
