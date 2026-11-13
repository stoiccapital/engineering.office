import { create } from 'zustand'
import { fetchProjektliste, saveProjektliste } from './api'
import {
  emptyProjektlisteDoc,
  type ForecastFlag,
  type ProjektlisteDoc,
  type ProjektlisteRow,
} from './types'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

type State = {
  doc: ProjektlisteDoc | null
  status: SaveStatus
  error: string | null
  search: string
  statusFilter: string
  load: () => Promise<void>
  setSearch: (q: string) => void
  setStatusFilter: (s: string) => void
  addRow: () => string
  updateRow: (id: string, patch: Partial<Omit<ProjektlisteRow, 'id'>>) => void
  removeRow: (id: string) => void
  // Replace the entire row set with imported data. Row IDs are preserved
  // for projects that already exist (match by name), new ones get fresh IDs.
  importRows: (rows: Omit<ProjektlisteRow, 'id' | 'updatedAt'>[]) => {
    added: number
    updated: number
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.doc) return
    try {
      await saveProjektliste({ ...s.doc, updatedAt: new Date().toISOString() })
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

function normNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function normFlag(v: unknown): ForecastFlag {
  if (v === 'k' || v === 'K') return 'k'
  if (v === 'w' || v === 'W') return 'w'
  return null
}

function normRow(r: Partial<ProjektlisteRow>): ProjektlisteRow {
  return {
    id: r.id ?? newId(),
    projekt: r.projekt ?? '',
    fachbereich: r.fachbereich ?? '',
    projektleiter: r.projektleiter ?? '',
    status: r.status ?? '',
    leistung: r.leistung ?? '',
    abrechnungsstandEur: normNum(r.abrechnungsstandEur),
    personalkosten: normNum(r.personalkosten),
    direkteKosten: normNum(r.direkteKosten),
    kostensumme: normNum(r.kostensumme),
    gewinnVerlust: normNum(r.gewinnVerlust),
    forecastGesamt: normNum(r.forecastGesamt),
    forecastGesamtFlag: normFlag(r.forecastGesamtFlag),
    forecastPl: normNum(r.forecastPl),
    forecastPlFlag: normFlag(r.forecastPlFlag),
    forecastDe: normNum(r.forecastDe),
    forecastDeFlag: normFlag(r.forecastDeFlag),
    abgerechnetGesamt: normNum(r.abgerechnetGesamt),
    abgerechnetPl: normNum(r.abgerechnetPl),
    abgerechnetDe: normNum(r.abgerechnetDe),
    offenerForecastDe: normNum(r.offenerForecastDe),
    offenerForecastPl: normNum(r.offenerForecastPl),
    updatedAt: r.updatedAt ?? new Date().toISOString(),
  }
}

function normalize(raw: ProjektlisteDoc | null): ProjektlisteDoc {
  if (!raw) return emptyProjektlisteDoc()
  return {
    rows: (raw.rows ?? []).map(normRow),
    importedAt: raw.importedAt,
    updatedAt: raw.updatedAt,
  }
}

export const useProjektliste = create<State>()((set, get) => ({
  doc: null,
  status: 'idle',
  error: null,
  search: '',
  statusFilter: '',

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const data = await fetchProjektliste()
      set({ doc: normalize(data), status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),

  addRow: () => {
    const s = get()
    if (!s.doc) return ''
    const row = normRow({})
    set({ doc: { ...s.doc, rows: [row, ...s.doc.rows] } })
    scheduleSave(get, (p) => set(p as Partial<State>))
    return row.id
  },

  updateRow: (id, patch) => {
    const s = get()
    if (!s.doc) return
    const rows = s.doc.rows.map((r) =>
      r.id === id
        ? {
            ...r,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        : r,
    )
    set({ doc: { ...s.doc, rows } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removeRow: (id) => {
    const s = get()
    if (!s.doc) return
    const rows = s.doc.rows.filter((r) => r.id !== id)
    set({ doc: { ...s.doc, rows } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  importRows: (incoming) => {
    const s = get()
    const existing = s.doc?.rows ?? []
    const byName = new Map<string, ProjektlisteRow>()
    for (const r of existing) {
      const k = r.projekt.trim().toLowerCase()
      if (k) byName.set(k, r)
    }
    let added = 0
    let updated = 0
    const next: ProjektlisteRow[] = []
    const seenNames = new Set<string>()
    for (const raw of incoming) {
      const name = (raw.projekt ?? '').trim()
      const key = name.toLowerCase()
      if (!name) continue
      if (seenNames.has(key)) continue
      seenNames.add(key)
      const prev = byName.get(key)
      if (prev) {
        next.push(normRow({ ...prev, ...raw, id: prev.id }))
        updated++
      } else {
        next.push(normRow(raw))
        added++
      }
    }
    // Keep existing rows that weren't present in the import (don't wipe
    // historical data silently). Append them after the imported set.
    const incomingNames = seenNames
    for (const r of existing) {
      if (!incomingNames.has(r.projekt.trim().toLowerCase())) next.push(r)
    }
    const doc: ProjektlisteDoc = {
      rows: next,
      importedAt: new Date().toISOString(),
    }
    set({ doc })
    scheduleSave(get, (p) => set(p as Partial<State>))
    return { added, updated }
  },
}))

// Filter + search helper used by the view. Case-insensitive match on
// projekt / projektleiter / fachbereich / status.
export function visibleRows(
  doc: ProjektlisteDoc,
  search: string,
  statusFilter: string,
): ProjektlisteRow[] {
  const q = search.trim().toLowerCase()
  return doc.rows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (!q) return true
    const hay = [r.projekt, r.projektleiter, r.fachbereich, r.status, r.leistung]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}
