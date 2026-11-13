import { create } from 'zustand'
import { fetchProjektliste, saveProjektliste } from './api'
import {
  emptyProjektlisteDoc,
  type ForecastFlag,
  type ProjektlisteDoc,
  type ProjektlisteRow,
} from './types'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'
export type ImportMode = 'merge' | 'replace'

export type ImportPreview = {
  mode: ImportMode
  // Parsed rows about to be imported (not committed yet).
  incoming: Omit<ProjektlisteRow, 'id' | 'updatedAt'>[]
  added: number
  updated: number
  // Rows currently in the doc that aren't in the import. Merge keeps them,
  // Replace drops them.
  keptOrRemoved: number
}

export type ProjektlisteSortCol =
  | 'projekt'
  | 'projektleiter'
  | 'status'
  | 'abrechnungsstandEur'
  | 'kostensumme'
  | 'gewinnVerlust'
  | 'forecastGesamt'
  | 'abgerechnetGesamt'
export type ProjektlisteSortDir = 'asc' | 'desc'
export type ProjektlisteSort = {
  col: ProjektlisteSortCol
  dir: ProjektlisteSortDir
}

const UNDO_IMPORT_MS = 15_000

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
  sort: ProjektlisteSort
  // Pre-commit staging for an Excel import — user sees the diff + picks
  // merge vs replace before anything is written.
  stagedImport: ImportPreview | null
  // After an import is committed, we keep a snapshot of the previous rows
  // for UNDO_IMPORT_MS so the user can revert the whole operation.
  lastImportBackup: {
    rows: ProjektlisteRow[]
    importedAt?: string
    expiresAt: number
  } | null
  load: () => Promise<void>
  setSearch: (q: string) => void
  setStatusFilter: (s: string) => void
  setSort: (sort: ProjektlisteSort) => void
  addRow: () => string
  updateRow: (id: string, patch: Partial<Omit<ProjektlisteRow, 'id'>>) => void
  removeRow: (id: string) => void
  // Stage: parse the preview without touching the doc.
  stageImport: (
    rows: Omit<ProjektlisteRow, 'id' | 'updatedAt'>[],
    mode: ImportMode,
  ) => void
  setStagedMode: (mode: ImportMode) => void
  cancelStagedImport: () => void
  // Commit the currently-staged import; captures a backup for undo.
  commitStagedImport: () => { added: number; updated: number }
  undoLastImport: () => void
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
  sort: { col: 'projekt', dir: 'asc' },
  stagedImport: null,
  lastImportBackup: null,

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
  setSort: (sort) => set({ sort }),

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

  stageImport: (incoming, mode) => {
    const s = get()
    const existing = s.doc?.rows ?? []
    const existingNames = new Set<string>()
    for (const r of existing) {
      const k = r.projekt.trim().toLowerCase()
      if (k) existingNames.add(k)
    }
    let added = 0
    let updated = 0
    const seenNames = new Set<string>()
    for (const raw of incoming) {
      const name = (raw.projekt ?? '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (seenNames.has(key)) continue
      seenNames.add(key)
      if (existingNames.has(key)) updated++
      else added++
    }
    // In merge mode these rows are preserved; in replace mode they're dropped.
    let keptOrRemoved = 0
    for (const n of existingNames) if (!seenNames.has(n)) keptOrRemoved++
    set({
      stagedImport: {
        mode,
        incoming,
        added,
        updated,
        keptOrRemoved,
      },
    })
  },

  setStagedMode: (mode) => {
    const s = get()
    if (!s.stagedImport) return
    // Re-stage so the kept/removed count reflects the new mode.
    get().stageImport(s.stagedImport.incoming, mode)
  },

  cancelStagedImport: () => set({ stagedImport: null }),

  commitStagedImport: () => {
    const s = get()
    if (!s.stagedImport || !s.doc) return { added: 0, updated: 0 }
    const { mode, incoming } = s.stagedImport
    const existing = s.doc.rows
    const byName = new Map<string, ProjektlisteRow>()
    for (const r of existing) {
      const k = r.projekt.trim().toLowerCase()
      if (k) byName.set(k, r)
    }
    let added = 0
    let updated = 0
    const seenNames = new Set<string>()
    const next: ProjektlisteRow[] = []
    for (const raw of incoming) {
      const name = (raw.projekt ?? '').trim()
      if (!name) continue
      const key = name.toLowerCase()
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
    if (mode === 'merge') {
      for (const r of existing) {
        if (!seenNames.has(r.projekt.trim().toLowerCase())) next.push(r)
      }
    }
    // Snapshot for undo.
    const backup = {
      rows: existing,
      importedAt: s.doc.importedAt,
      expiresAt: Date.now() + UNDO_IMPORT_MS,
    }
    const doc: ProjektlisteDoc = {
      rows: next,
      importedAt: new Date().toISOString(),
    }
    set({ doc, stagedImport: null, lastImportBackup: backup })
    scheduleSave(get, (p) => set(p as Partial<State>))
    setTimeout(() => {
      const st = get()
      if (st.lastImportBackup && st.lastImportBackup.expiresAt <= Date.now()) {
        set({ lastImportBackup: null })
      }
    }, UNDO_IMPORT_MS + 100)
    return { added, updated }
  },

  undoLastImport: () => {
    const s = get()
    if (!s.lastImportBackup || !s.doc) return
    set({
      doc: {
        rows: s.lastImportBackup.rows,
        importedAt: s.lastImportBackup.importedAt,
      },
      lastImportBackup: null,
    })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))

// Filter + search + sort helper used by the view. Case-insensitive match on
// projekt / projektleiter / fachbereich / status / leistung, then sorted.
export function visibleRows(
  doc: ProjektlisteDoc,
  search: string,
  statusFilter: string,
  sort: ProjektlisteSort,
): ProjektlisteRow[] {
  const q = search.trim().toLowerCase()
  const filtered = doc.rows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (!q) return true
    const hay = [r.projekt, r.projektleiter, r.fachbereich, r.status, r.leistung]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
  const sorted = [...filtered].sort((a, b) => cmp(a, b, sort.col))
  if (sort.dir === 'desc') sorted.reverse()
  return sorted
}

function cmp(a: ProjektlisteRow, b: ProjektlisteRow, col: ProjektlisteSortCol): number {
  switch (col) {
    case 'projekt':
      return a.projekt.localeCompare(b.projekt)
    case 'projektleiter':
      return a.projektleiter.localeCompare(b.projektleiter)
    case 'status':
      return a.status.localeCompare(b.status)
    case 'abrechnungsstandEur':
      return (a.abrechnungsstandEur ?? 0) - (b.abrechnungsstandEur ?? 0)
    case 'kostensumme':
      return (a.kostensumme ?? 0) - (b.kostensumme ?? 0)
    case 'gewinnVerlust':
      return (a.gewinnVerlust ?? 0) - (b.gewinnVerlust ?? 0)
    case 'forecastGesamt':
      return (a.forecastGesamt ?? 0) - (b.forecastGesamt ?? 0)
    case 'abgerechnetGesamt':
      return (a.abgerechnetGesamt ?? 0) - (b.abgerechnetGesamt ?? 0)
  }
}

// Aggregate totals for the whole doc — used for the "shown / total" header.
export function totalSums(rows: ProjektlisteRow[]) {
  return {
    count: rows.length,
    kosten: rows.reduce((s, r) => s + (r.kostensumme ?? 0), 0),
    gewinn: rows.reduce((s, r) => s + (r.gewinnVerlust ?? 0), 0),
    forecast: rows.reduce((s, r) => s + (r.forecastGesamt ?? 0), 0),
    abgerechnet: rows.reduce((s, r) => s + (r.abgerechnetGesamt ?? 0), 0),
  }
}
