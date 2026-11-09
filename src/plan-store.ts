import { create } from 'zustand'
import type { Branch, Employee, PlanStatus, PoolTask, QuartalPlan, WeekTodo } from './types'
import { migratePlan } from './types'
import { fetchPlan, savePlan } from './api'
import { currentISOWeek, quarterOfISOWeek, type QuarterLabel } from './lib/iso-week'

const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_QUARTER: QuarterLabel = (() => {
  const { year, week } = currentISOWeek()
  return quarterOfISOWeek(year, week)
})()

export type QuarterView = 'all' | QuarterLabel
export type TeamFilter = 'all' | Branch

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function emptyPlan(year: number): QuartalPlan {
  return {
    year,
    employees: [
      { id: newId(), name: 'Mitarbeiter 1', branch: 'de' },
      { id: newId(), name: 'Mitarbeiter 2', branch: 'de' },
      { id: newId(), name: 'Mitarbeiter 3', branch: 'pl' },
      { id: newId(), name: 'Mitarbeiter 4', branch: 'pl' },
    ],
    cells: {},
    todos: {},
  }
}

export function cellKey(empIndex: number, week: number): string {
  return `${empIndex}:${week}`
}

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  year: number
  quarter: QuarterView
  teamFilter: TeamFilter
  plan: QuartalPlan | null
  status: SaveStatus
  error: string | null
  setYear: (y: number) => void
  setQuarter: (q: QuarterView) => void
  setTeamFilter: (t: TeamFilter) => void
  load: () => Promise<void>
  setCell: (empIndex: number, week: number, status: PlanStatus | null) => void
  renameEmployee: (empIndex: number, name: string) => void
  setEmployeeBranch: (empIndex: number, branch: Branch) => void
  addEmployee: (branch?: Branch) => void
  // Add a plan.employee linked to a RosterEmployee. Prevents duplicates
  // when the roster entry is already in the plan.
  addRosterEmployee: (rosterEmployeeId: string, name: string, branch: Branch) => void
  removeEmployee: (empIndex: number) => void
  addTodo: (empIndex: number, week: number) => void
  updateTodo: (
    empIndex: number,
    week: number,
    id: string,
    patch: Partial<Omit<WeekTodo, 'id'>>,
  ) => void
  removeTodo: (empIndex: number, week: number, id: string) => void
  // Backlog pool of unscheduled tasks the PM has drafted. Each pool task
  // belongs to a specific employee column.
  addPoolTask: (empIndex: number, text?: string) => void
  updatePoolTask: (id: string, text: string) => void
  removePoolTask: (id: string) => void
  // Promote a pool task into a KW cell of its own employee as a new WeekTodo.
  // The pool entry is removed on success.
  assignPoolTask: (poolId: string, week: number) => void
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
  teamFilter: 'all',
  plan: null,
  status: 'idle',
  error: null,

  setYear: (y) => {
    set({ year: y })
    void get().load()
  },

  setQuarter: (q) => set({ quarter: q }),

  setTeamFilter: (t) => set({ teamFilter: t }),

  load: async () => {
    const s = get()
    set({ status: 'loading', error: null })
    try {
      const data = await fetchPlan(s.year)
      const migrated = migratePlan(data as never) ?? emptyPlan(s.year)
      set({ plan: migrated, status: 'saved' })
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
    const employees = s.plan.employees.map((e, i) => (i === empIndex ? { ...e, name } : e))
    set({ plan: { ...s.plan, employees } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  setEmployeeBranch: (empIndex, branch) => {
    const s = get()
    if (!s.plan) return
    const employees = s.plan.employees.map((e, i) => (i === empIndex ? { ...e, branch } : e))
    set({ plan: { ...s.plan, employees } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  addEmployee: (branch = 'de') => {
    const s = get()
    if (!s.plan) return
    const newEmp: Employee = {
      id: newId(),
      name: `Mitarbeiter ${s.plan.employees.length + 1}`,
      branch,
    }
    const employees = [...s.plan.employees, newEmp]
    set({ plan: { ...s.plan, employees } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  addRosterEmployee: (rosterEmployeeId, name, branch) => {
    const s = get()
    if (!s.plan) return
    // Guard: skip if the roster entry is already linked in this plan.
    if (s.plan.employees.some((e) => e.rosterEmployeeId === rosterEmployeeId)) return
    const newEmp: Employee = {
      id: newId(),
      name,
      branch,
      rosterEmployeeId,
    }
    const employees = [...s.plan.employees, newEmp]
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
    // reindex pool tasks: drop the removed employee's pool, shift higher down.
    const pool: PoolTask[] = (s.plan.pool ?? [])
      .filter((t) => t.empIndex !== empIndex)
      .map((t) => ({ ...t, empIndex: t.empIndex > empIndex ? t.empIndex - 1 : t.empIndex }))
    set({ plan: { ...s.plan, employees, cells, todos, pool } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  addTodo: (empIndex, week) => {
    const s = get()
    if (!s.plan) return
    const k = cellKey(empIndex, week)
    const current = s.plan.todos?.[k] ?? []
    const todo: WeekTodo = { id: newId(), text: '', state: 'offen' }
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

  addPoolTask: (empIndex, text = '') => {
    const s = get()
    if (!s.plan) return
    const pool = [...(s.plan.pool ?? []), { id: newId(), text, empIndex }]
    set({ plan: { ...s.plan, pool } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  updatePoolTask: (id, text) => {
    const s = get()
    if (!s.plan) return
    const pool = (s.plan.pool ?? []).map((t) => (t.id === id ? { ...t, text } : t))
    set({ plan: { ...s.plan, pool } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  removePoolTask: (id) => {
    const s = get()
    if (!s.plan) return
    const pool = (s.plan.pool ?? []).filter((t) => t.id !== id)
    set({ plan: { ...s.plan, pool } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },

  assignPoolTask: (poolId, week) => {
    const s = get()
    if (!s.plan) return
    const poolEntry: PoolTask | undefined = (s.plan.pool ?? []).find((t) => t.id === poolId)
    if (!poolEntry) return
    const k = cellKey(poolEntry.empIndex, week)
    const current = s.plan.todos?.[k] ?? []
    const todo: WeekTodo = { id: newId(), text: poolEntry.text, state: 'offen' }
    const todos = { ...(s.plan.todos ?? {}), [k]: [...current, todo] }
    const pool = (s.plan.pool ?? []).filter((t) => t.id !== poolId)
    set({ plan: { ...s.plan, todos, pool } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))
