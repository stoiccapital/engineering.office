import { create } from 'zustand'
import type { PlanStatus, QuartalPlan, WeekTodo } from './types'
import { MAX_TODOS_PER_WEEK } from './types'
import { fetchPlan, savePlan } from './api'
import { currentISOWeek, quarterOfISOWeek, type QuarterLabel } from './lib/iso-week'

const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_QUARTER: QuarterLabel = (() => {
  const { year, week } = currentISOWeek()
  return quarterOfISOWeek(year, week)
})()

export type QuarterView = 'all' | QuarterLabel

function emptyPlan(year: number): QuartalPlan {
  return {
    year,
    employees: ['Mitarbeiter 1', 'Mitarbeiter 2', 'Mitarbeiter 3', 'Mitarbeiter 4'],
    cells: {},
  }
}

export function cellKey(empIndex: number, week: number): string {
  return `${empIndex}:${week}`
}

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  year: number
  quarter: QuarterView
  plan: QuartalPlan | null
  status: SaveStatus
  error: string | null
  setYear: (y: number) => void
  setQuarter: (q: QuarterView) => void
  load: () => Promise<void>
  setCell: (empIndex: number, week: number, status: PlanStatus | null) => void
  renameEmployee: (empIndex: number, name: string) => void
  addEmployee: () => void
  removeEmployee: (empIndex: number) => void
  addTodo: (empIndex: number, week: number) => void
  updateTodo: (
    empIndex: number,
    week: number,
    id: string,
    patch: Partial<Omit<WeekTodo, 'id'>>,
  ) => void
  removeTodo: (empIndex: number, week: number, id: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.plan) return
    try {
      await savePlan(s.year, s.plan)
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

export const usePlan = create<State>()((set, get) => ({
  year: CURRENT_YEAR,
  quarter: INITIAL_QUARTER,
  plan: null,
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
      const data = await fetchPlan(s.year)
      set({ plan: data ?? emptyPlan(s.year), status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  setCell: (empIndex, week, status) => {
    const s = get()
    if (!s.plan) return
    const cells = { ...s.plan.cells }
    const k = cellKey(empIndex, week)
    if (status === null) delete cells[k]
    else cells[k] = status
    set({ plan: { ...s.plan, cells } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  renameEmployee: (empIndex, name) => {
    const s = get()
    if (!s.plan) return
    const employees = s.plan.employees.map((e, i) => (i === empIndex ? name : e))
    set({ plan: { ...s.plan, employees } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  addEmployee: () => {
    const s = get()
    if (!s.plan) return
    const employees = [...s.plan.employees, `Mitarbeiter ${s.plan.employees.length + 1}`]
    set({ plan: { ...s.plan, employees } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removeEmployee: (empIndex) => {
    const s = get()
    if (!s.plan) return
    const employees = s.plan.employees.filter((_, i) => i !== empIndex)
    // reindex cells: drop removed column, shift higher indices down by 1
    const cells: Record<string, PlanStatus> = {}
    for (const [k, v] of Object.entries(s.plan.cells)) {
      const [eStr, wStr] = k.split(':')
      const e = Number(eStr)
      if (e === empIndex) continue
      const newE = e > empIndex ? e - 1 : e
      cells[cellKey(newE, Number(wStr))] = v
    }
    // reindex todos the same way
    const todos: Record<string, WeekTodo[]> = {}
    for (const [k, v] of Object.entries(s.plan.todos ?? {})) {
      const [eStr, wStr] = k.split(':')
      const e = Number(eStr)
      if (e === empIndex) continue
      const newE = e > empIndex ? e - 1 : e
      todos[cellKey(newE, Number(wStr))] = v
    }
    set({ plan: { ...s.plan, employees, cells, todos } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  addTodo: (empIndex, week) => {
    const s = get()
    if (!s.plan) return
    const k = cellKey(empIndex, week)
    const current = s.plan.todos?.[k] ?? []
    if (current.length >= MAX_TODOS_PER_WEEK) return
    const todo: WeekTodo = { id: newId(), text: '', done: false }
    const todos = { ...(s.plan.todos ?? {}), [k]: [...current, todo] }
    set({ plan: { ...s.plan, todos } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updateTodo: (empIndex, week, id, patch) => {
    const s = get()
    if (!s.plan) return
    const k = cellKey(empIndex, week)
    const current = s.plan.todos?.[k] ?? []
    const next = current.map((t) => (t.id === id ? { ...t, ...patch } : t))
    const todos = { ...(s.plan.todos ?? {}), [k]: next }
    set({ plan: { ...s.plan, todos } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removeTodo: (empIndex, week, id) => {
    const s = get()
    if (!s.plan) return
    const k = cellKey(empIndex, week)
    const current = s.plan.todos?.[k] ?? []
    const next = current.filter((t) => t.id !== id)
    const allTodos = { ...(s.plan.todos ?? {}) }
    if (next.length === 0) delete allTodos[k]
    else allTodos[k] = next
    set({ plan: { ...s.plan, todos: allTodos } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
