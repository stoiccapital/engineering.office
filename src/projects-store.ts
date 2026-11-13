import { create } from 'zustand'
import { fetchProjects, saveProjects } from './api'
import {
  emptyProjekteDoc,
  PROJEKT_PRIORITY_RANK,
  type ProjekteDoc,
  type ProjektPriority,
  type ProjektRow,
  type ProjektStatus,
  type ProjektTodo,
} from './types'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'
export type ProjektFilter = 'mine' | 'all'
export type ProjektSortCol = 'status' | 'priority' | 'frist' | 'updatedAt'
export type ProjektSortDir = 'asc' | 'desc'
export type ProjektSort = { col: ProjektSortCol; dir: ProjektSortDir }

const UNDO_MS = 5000

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

type State = {
  doc: ProjekteDoc | null
  status: SaveStatus
  error: string | null
  filter: ProjektFilter
  sort: ProjektSort
  selectedProjectId: string | null
  // Soft-delete window: rows pending final removal. Keyed by project id.
  pendingDeletes: Record<string, ProjektRow>
  load: () => Promise<void>
  setFilter: (f: ProjektFilter) => void
  setSort: (s: ProjektSort) => void
  selectProject: (id: string | null) => void
  addRow: (ownerKuerzel: string) => string
  updateRow: (id: string, patch: Partial<Omit<ProjektRow, 'id' | 'ownerKuerzel' | 'createdAt' | 'todos'>>) => void
  // Starts the undo window — doc update happens only when the timer fires.
  softDeleteRow: (id: string) => void
  undoDeleteRow: (id: string) => void
  addTodo: (projectId: string) => void
  updateTodo: (projectId: string, todoId: string, patch: Partial<Omit<ProjektTodo, 'id' | 'createdAt'>>) => void
  removeTodo: (projectId: string, todoId: string) => void
  setMyNotes: (kuerzel: string, notes: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

// Per-row soft-delete timers kept outside Zustand so they can be cleared
// without re-rendering the whole store.
const pendingTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.doc) return
    try {
      await saveProjects({ ...s.doc, updatedAt: new Date().toISOString() })
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

function normalize(raw: ProjekteDoc | null): ProjekteDoc {
  if (!raw) return emptyProjekteDoc()
  return {
    rows: (raw.rows ?? []).map((r) => {
      // Legacy rows carried a single `todo: string`. Convert to one todo
      // entry so the PM can grow it from there.
      const legacy = (r as unknown as { todo?: string }).todo
      const todos: ProjektTodo[] = (r.todos ?? []).map((t) => ({
        id: t.id,
        text: t.text ?? '',
        assigneeKuerzel: t.assigneeKuerzel,
        done: !!t.done,
        createdAt: t.createdAt ?? new Date().toISOString(),
      }))
      if (todos.length === 0 && typeof legacy === 'string' && legacy.trim()) {
        todos.push({
          id: newId(),
          text: legacy,
          done: false,
          createdAt: new Date().toISOString(),
        })
      }
      return {
        id: r.id,
        projekt: r.projekt ?? '',
        todos,
        bemerkung: r.bemerkung ?? '',
        frist: r.frist ?? '',
        status: (r.status as ProjektStatus) ?? 'offen',
        priority: (r.priority as ProjektPriority) ?? 'mittel',
        ownerKuerzel: r.ownerKuerzel ?? '',
        pmKuerzel: r.pmKuerzel,
        assigneeKuerzels: r.assigneeKuerzels ?? [],
        createdAt: r.createdAt ?? new Date().toISOString(),
        updatedAt: r.updatedAt ?? new Date().toISOString(),
      }
    }),
    notesByUser: raw.notesByUser ?? {},
  }
}

export const useProjects = create<State>()((set, get) => ({
  doc: null,
  status: 'idle',
  error: null,
  filter: 'mine',
  sort: { col: 'updatedAt', dir: 'desc' },
  selectedProjectId: null,
  pendingDeletes: {},

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const data = await fetchProjects()
      set({ doc: normalize(data), status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  setFilter: (filter) => set({ filter }),

  setSort: (sort) => set({ sort }),

  selectProject: (id) => set({ selectedProjectId: id }),

  addRow: (ownerKuerzel) => {
    const s = get()
    if (!s.doc) return ''
    const now = new Date().toISOString()
    const row: ProjektRow = {
      id: newId(),
      projekt: '',
      todos: [],
      bemerkung: '',
      frist: '',
      status: 'offen',
      priority: 'mittel',
      ownerKuerzel,
      assigneeKuerzels: [],
      createdAt: now,
      updatedAt: now,
    }
    set({ doc: { ...s.doc, rows: [...s.doc.rows, row] } })
    scheduleSave(get, (p) => set(p as Partial<State>))
    return row.id
  },

  addTodo: (projectId) => {
    const s = get()
    if (!s.doc) return
    const rows = s.doc.rows.map((r) => {
      if (r.id !== projectId) return r
      const todo: ProjektTodo = {
        id: newId(),
        text: '',
        done: false,
        createdAt: new Date().toISOString(),
      }
      return { ...r, todos: [...r.todos, todo], updatedAt: new Date().toISOString() }
    })
    set({ doc: { ...s.doc, rows } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateTodo: (projectId, todoId, patch) => {
    const s = get()
    if (!s.doc) return
    const rows = s.doc.rows.map((r) => {
      if (r.id !== projectId) return r
      const todos = r.todos.map((t) => (t.id === todoId ? { ...t, ...patch } : t))
      return { ...r, todos, updatedAt: new Date().toISOString() }
    })
    set({ doc: { ...s.doc, rows } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removeTodo: (projectId, todoId) => {
    const s = get()
    if (!s.doc) return
    const rows = s.doc.rows.map((r) => {
      if (r.id !== projectId) return r
      return {
        ...r,
        todos: r.todos.filter((t) => t.id !== todoId),
        updatedAt: new Date().toISOString(),
      }
    })
    set({ doc: { ...s.doc, rows } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateRow: (id, patch) => {
    const s = get()
    if (!s.doc) return
    const rows = s.doc.rows.map((r) =>
      r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r,
    )
    set({ doc: { ...s.doc, rows } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  // Soft delete: the row is hidden locally and queued for deletion. If the
  // user hits Rückgängig within UNDO_MS, the row is restored and the timer
  // is cleared before the actual server write happens.
  softDeleteRow: (id) => {
    const s = get()
    if (!s.doc) return
    const row = s.doc.rows.find((r) => r.id === id)
    if (!row) return
    const pendingDeletes = { ...s.pendingDeletes, [id]: row }
    const selected = s.selectedProjectId === id ? null : s.selectedProjectId
    set({ pendingDeletes, selectedProjectId: selected })
    pendingTimers[id] = setTimeout(() => {
      const st = get()
      // Still pending? Then commit.
      if (!st.pendingDeletes[id] || !st.doc) return
      const { [id]: _removed, ...rest } = st.pendingDeletes
      const rows = st.doc.rows.filter((r) => r.id !== id)
      set({ doc: { ...st.doc, rows }, pendingDeletes: rest })
      delete pendingTimers[id]
      scheduleSave(get, (p) => set(p as Partial<State>))
    }, UNDO_MS)
  },

  undoDeleteRow: (id) => {
    const s = get()
    if (!s.pendingDeletes[id]) return
    const t = pendingTimers[id]
    if (t) {
      clearTimeout(t)
      delete pendingTimers[id]
    }
    const { [id]: _removed, ...rest } = s.pendingDeletes
    set({ pendingDeletes: rest })
  },

  setMyNotes: (kuerzel, notes) => {
    const s = get()
    if (!s.doc) return
    const notesByUser = { ...s.doc.notesByUser, [kuerzel]: notes }
    set({ doc: { ...s.doc, notesByUser } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))

// Returns rows visible to a given kuerzel under the current filter,
// excluding rows pending soft-delete, sorted per the current sort spec.
export function visibleRows(
  doc: ProjekteDoc,
  kuerzel: string | null,
  filter: ProjektFilter,
  pending: Record<string, ProjektRow>,
  sort: ProjektSort,
): ProjektRow[] {
  let rows = doc.rows.filter((r) => !pending[r.id])
  if (filter === 'mine') {
    if (!kuerzel) return []
    const k = kuerzel.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.ownerKuerzel.toLowerCase() === k ||
        (r.pmKuerzel && r.pmKuerzel.toLowerCase() === k) ||
        r.assigneeKuerzels.some((a) => a.toLowerCase() === k) ||
        r.todos.some((t) => t.assigneeKuerzel && t.assigneeKuerzel.toLowerCase() === k),
    )
  }
  const sorted = [...rows].sort((a, b) => cmpBy(a, b, sort.col))
  if (sort.dir === 'desc') sorted.reverse()
  return sorted
}

function cmpBy(a: ProjektRow, b: ProjektRow, col: ProjektSortCol): number {
  switch (col) {
    case 'priority':
      return PROJEKT_PRIORITY_RANK[a.priority] - PROJEKT_PRIORITY_RANK[b.priority]
    case 'status':
      return a.status.localeCompare(b.status)
    case 'frist': {
      // Empty frist sorts to the end regardless of direction.
      if (!a.frist && !b.frist) return 0
      if (!a.frist) return 1
      if (!b.frist) return -1
      return a.frist.localeCompare(b.frist)
    }
    case 'updatedAt':
    default:
      return a.updatedAt.localeCompare(b.updatedAt)
  }
}

// Counts open todos assigned to a given kuerzel across the whole doc.
export function myOpenTodoCount(doc: ProjekteDoc, kuerzel: string | null): number {
  if (!kuerzel) return 0
  const k = kuerzel.toLowerCase()
  let n = 0
  for (const r of doc.rows) {
    for (const t of r.todos) {
      if (!t.done && t.assigneeKuerzel && t.assigneeKuerzel.toLowerCase() === k) n++
    }
  }
  return n
}

export function isOverdue(frist: string, status: ProjektStatus): boolean {
  if (status === 'erledigt') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(frist)) return false
  const today = new Date().toISOString().slice(0, 10)
  return frist < today
}

export function fmtFrist(frist: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(frist)) {
    const [y, m, d] = frist.split('-')
    return `${d}.${m}.${y}`
  }
  return frist
}
