import { create } from 'zustand'
import { fetchProjects, saveProjects } from './api'
import {
  emptyProjekteDoc,
  type ProjekteDoc,
  type ProjektRow,
  type ProjektStatus,
  type ProjektTodo,
} from './types'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'
export type ProjektFilter = 'mine' | 'all'

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

type State = {
  doc: ProjekteDoc | null
  status: SaveStatus
  error: string | null
  filter: ProjektFilter
  selectedProjectId: string | null
  load: () => Promise<void>
  setFilter: (f: ProjektFilter) => void
  selectProject: (id: string | null) => void
  addRow: (ownerKuerzel: string) => void
  updateRow: (id: string, patch: Partial<Omit<ProjektRow, 'id' | 'ownerKuerzel' | 'createdAt' | 'todos'>>) => void
  removeRow: (id: string) => void
  addTodo: (projectId: string) => void
  updateTodo: (projectId: string, todoId: string, patch: Partial<Omit<ProjektTodo, 'id' | 'createdAt'>>) => void
  removeTodo: (projectId: string, todoId: string) => void
  setMyNotes: (kuerzel: string, notes: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

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
  selectedProjectId: null,

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

  selectProject: (id) => set({ selectedProjectId: id }),

  addRow: (ownerKuerzel) => {
    const s = get()
    if (!s.doc) return
    const now = new Date().toISOString()
    const row: ProjektRow = {
      id: newId(),
      projekt: '',
      todos: [],
      bemerkung: '',
      frist: '',
      status: 'offen',
      ownerKuerzel,
      assigneeKuerzels: [],
      createdAt: now,
      updatedAt: now,
    }
    set({ doc: { ...s.doc, rows: [...s.doc.rows, row] } })
    scheduleSave(get, (p) => set(p as Partial<State>))
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

  removeRow: (id) => {
    const s = get()
    if (!s.doc) return
    const rows = s.doc.rows.filter((r) => r.id !== id)
    const selected = s.selectedProjectId === id ? null : s.selectedProjectId
    set({ doc: { ...s.doc, rows }, selectedProjectId: selected })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  setMyNotes: (kuerzel, notes) => {
    const s = get()
    if (!s.doc) return
    const notesByUser = { ...s.doc.notesByUser, [kuerzel]: notes }
    set({ doc: { ...s.doc, notesByUser } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))

// Returns rows visible to a given kuerzel under the current filter.
export function visibleRows(doc: ProjekteDoc, kuerzel: string | null, filter: ProjektFilter): ProjektRow[] {
  if (filter === 'all') return doc.rows
  if (!kuerzel) return []
  const k = kuerzel.toLowerCase()
  return doc.rows.filter(
    (r) =>
      r.ownerKuerzel.toLowerCase() === k ||
      (r.pmKuerzel && r.pmKuerzel.toLowerCase() === k) ||
      r.assigneeKuerzels.some((a) => a.toLowerCase() === k),
  )
}
