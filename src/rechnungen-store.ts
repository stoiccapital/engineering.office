import { create } from 'zustand'
import {
  emptyNEntry,
  emptyRechnungsplan,
  emptyRechnungsplanRow,
  rechnungsplanKey,
  type NEntry,
  type NoteColumn,
  type Rechnungsplan,
  type RechnungsplanRow,
} from './types'
import { fetchRechnungsplan, saveRechnungsplan } from './api'

const now = new Date()
const CURRENT_YEAR = now.getFullYear()
const CURRENT_MONTH = now.getMonth() + 1

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  year: number
  month: number
  data: Rechnungsplan | null
  status: SaveStatus
  error: string | null
  setYear: (y: number) => void
  setMonth: (m: number) => void
  load: () => Promise<void>
  addRow: () => void
  updateRow: (id: string, patch: Partial<Omit<RechnungsplanRow, 'id'>>) => void
  removeRow: (id: string) => void
  updateNote: (id: string, columnId: string, text: string) => void
  updateNEntry: (id: string, slot: NEntrySlot, patch: Partial<NEntry>) => void
  setNachtragCount: (n: number) => void
  setShowZeithonorar: (show: boolean) => void
  renameNoteColumn: (columnId: string, label: string) => void
  copyFromPreviousMonth: () => Promise<void>
}

export type NEntrySlot =
  | { kind: 'hv' }
  | { kind: 'nachtrag'; index: number }
  | { kind: 'zeithonorar' }

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.data) return
    try {
      await saveRechnungsplan(s.year, s.month, s.data)
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

function normalizeNachtraege(entries: NEntry[], target: number): NEntry[] {
  if (entries.length === target) return entries
  if (entries.length > target) return entries.slice(0, target)
  return [...entries, ...Array.from({ length: target - entries.length }, () => emptyNEntry())]
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

function carryForward(prev: Rechnungsplan, year: number, month: number): Rechnungsplan {
  // Copy project rows from prev but reset dynamic status entries.
  // Rows keep projNr/projektname/pl/notes so the PM only edits the deltas.
  const rows: RechnungsplanRow[] = prev.rows.map((r) => ({
    ...r,
    id: newId(),
    deStatus: 'aktuell',
    hv: { status: r.hv.status === 'nichtRelevant' ? 'nichtRelevant' : 'aktuell' },
    nachtraege: r.nachtraege.map((n) => ({
      status: n.status === 'nichtRelevant' ? 'nichtRelevant' : 'aktuell',
    })),
    zeithonorar: r.zeithonorar ? { status: 'aktuell' } : undefined,
    rgSummeDE: null,
    rgSummePL: null,
    nachtragErbracht: null,
  }))
  return {
    year,
    month,
    nachtragCount: prev.nachtragCount,
    showZeithonorar: prev.showZeithonorar,
    noteColumns: prev.noteColumns.map((n) => ({ ...n })),
    rows,
  }
}

export const useRechnungen = create<State>()((set, get) => ({
  year: CURRENT_YEAR,
  month: CURRENT_MONTH,
  data: null,
  status: 'idle',
  error: null,

  setYear: (y) => {
    set({ year: y })
    void get().load()
  },

  setMonth: (m) => {
    set({ month: m })
    void get().load()
  },

  load: async () => {
    const s = get()
    set({ status: 'loading', error: null })
    try {
      const data = await fetchRechnungsplan(s.year, s.month)
      set({ data: data ?? emptyRechnungsplan(s.year, s.month), status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  addRow: () => {
    const s = get()
    if (!s.data) return
    const row = emptyRechnungsplanRow(s.data.nachtragCount, s.data.showZeithonorar)
    row.id = newId()
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

  updateNote: (id, columnId, text) => {
    const s = get()
    if (!s.data) return
    set({
      data: {
        ...s.data,
        rows: s.data.rows.map((r) =>
          r.id === id ? { ...r, notes: { ...r.notes, [columnId]: text } } : r,
        ),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateNEntry: (id, slot, patch) => {
    const s = get()
    if (!s.data) return
    set({
      data: {
        ...s.data,
        rows: s.data.rows.map((r) => {
          if (r.id !== id) return r
          if (slot.kind === 'hv') return { ...r, hv: { ...r.hv, ...patch } }
          if (slot.kind === 'zeithonorar') {
            return {
              ...r,
              zeithonorar: { ...(r.zeithonorar ?? emptyNEntry()), ...patch },
            }
          }
          const next = r.nachtraege.slice()
          next[slot.index] = { ...next[slot.index], ...patch }
          return { ...r, nachtraege: next }
        }),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  setNachtragCount: (n) => {
    const s = get()
    if (!s.data) return
    const clamped = Math.max(0, Math.min(20, n))
    set({
      data: {
        ...s.data,
        nachtragCount: clamped,
        rows: s.data.rows.map((r) => ({
          ...r,
          nachtraege: normalizeNachtraege(r.nachtraege, clamped),
        })),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  setShowZeithonorar: (show) => {
    const s = get()
    if (!s.data) return
    set({
      data: {
        ...s.data,
        showZeithonorar: show,
        rows: s.data.rows.map((r) => ({
          ...r,
          zeithonorar: show ? (r.zeithonorar ?? emptyNEntry()) : undefined,
        })),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  renameNoteColumn: (columnId, label) => {
    const s = get()
    if (!s.data) return
    set({
      data: {
        ...s.data,
        noteColumns: s.data.noteColumns.map((c): NoteColumn =>
          c.id === columnId ? { ...c, label } : c,
        ),
      },
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  copyFromPreviousMonth: async () => {
    const s = get()
    if (!s.data) return
    const prev = previousMonth(s.year, s.month)
    try {
      const source = await fetchRechnungsplan(prev.year, prev.month)
      if (!source || source.rows.length === 0) return
      const next = carryForward(source, s.year, s.month)
      set({ data: next })
      scheduleSave(get, (p) => set(p as Partial<State>))
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },
}))

// Kept for callers that still import rechnungsplanKey through this file.
export { rechnungsplanKey }
