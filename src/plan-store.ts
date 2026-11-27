import { create } from 'zustand'
import type { Branch, Employee, PlanStatus, PoolTask, QuartalPlan, WeekTodo } from './types'
import { migratePlan } from './types'
import { fetchPlan, savePlan } from './api'
import { createAutosave } from './lib/autosave'
import { currentISOWeek, quarterOfISOWeek, type QuarterLabel } from './lib/iso-week'
import { logActivity } from '@/activity-store'

// Short helpers so the activity-log call sites stay readable. target is a
// human-readable label, not an id, so admins can scan the log.
function empLabel(plan: QuartalPlan | null, empIndex: number): string {
  const emp = plan?.employees[empIndex]
  return emp ? `${emp.name}` : `MA-${empIndex}`
}
function log(action: string, target?: string) {
  logActivity({ kind: 'action', module: 'plan', action, target })
}

const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_QUARTER: QuarterLabel = (() => {
  const { year, week } = currentISOWeek()
  return quarterOfISOWeek(year, week)
})()

export type QuarterView = 'all' | QuarterLabel
// 'all' = show every employee; otherwise a roster team id — only roster-linked
// employees whose rosterEmployee.teamId matches are shown.
export type TeamFilter = 'all' | string

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
  // Move a todo between cells (reassign employee + week) or reorder within
  // the same cell. Called from the drag-and-drop handler in QuartalPlanTable.
  moveTodo: (
    from: { empIndex: number; week: number },
    to: { empIndex: number; week: number },
    todoId: string,
    toIndex: number,
  ) => void
  // Move every week-todo and pool task of `fromEmpIndex` onto `toEmpIndex`.
  // Existing target lists are preserved; moved todos are appended after them.
  moveAllTodos: (fromEmpIndex: number, toEmpIndex: number) => void
}

export const usePlan = create<State>()((set, get) => {
  // Autosave: debounced save with lifecycle flush (beforeunload, pagehide,
  // visibilitychange=hidden). See src/lib/autosave.ts.
  const autosave = createAutosave<{ year: number; plan: QuartalPlan }>({
    save: async (p, mode) => {
      if (mode === 'keepalive') {
        await savePlan(p.year, p.plan, { keepalive: true })
        return
      }
      try {
        await savePlan(p.year, p.plan)
        set({ status: 'saved', error: null })
      } catch (e) {
        set({ status: 'error', error: (e as Error).message })
      }
    },
  })
  function scheduleSave() {
    const s = get()
    if (!s.plan) return
    set({ status: 'saving' })
    autosave.schedule({ year: s.year, plan: s.plan })
  }
  return {
  year: CURRENT_YEAR,
  quarter: INITIAL_QUARTER,
  teamFilter: 'all',
  plan: null,
  status: 'idle',
  error: null,

  setYear: async (y) => {
    // Flush before swapping documents — any pending save belongs to the OLD
    // year and would otherwise fire with the NEW plan payload.
    await autosave.flush()
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
    log(
      status === null ? 'cell.clear' : `cell.set.${status}`,
      `KW ${week} · ${empLabel(s.plan, empIndex)}`,
    )
    scheduleSave()
  },

  renameEmployee: (empIndex, name) => {
    const s = get()
    if (!s.plan) return
    const employees = s.plan.employees.map((e, i) => (i === empIndex ? { ...e, name } : e))
    set({ plan: { ...s.plan, employees } })
    log('employee.rename', `${empLabel(s.plan, empIndex)} → ${name}`)
    scheduleSave()
  },

  setEmployeeBranch: (empIndex, branch) => {
    const s = get()
    if (!s.plan) return
    const employees = s.plan.employees.map((e, i) => (i === empIndex ? { ...e, branch } : e))
    set({ plan: { ...s.plan, employees } })
    log('employee.branch', `${empLabel(s.plan, empIndex)} → ${branch}`)
    scheduleSave()
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
    log('employee.add', newEmp.name)
    scheduleSave()
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
    const dismissedRosterEmployeeIds = (s.plan.dismissedRosterEmployeeIds ?? []).filter(
      (id) => id !== rosterEmployeeId,
    )
    set({ plan: { ...s.plan, employees, dismissedRosterEmployeeIds } })
    log('employee.add.roster', name)
    scheduleSave()
  },

  removeEmployee: (empIndex) => {
    const s = get()
    if (!s.plan) return
    const removed = s.plan.employees[empIndex]
    if (removed) log('employee.remove', removed.name)
    const employees = s.plan.employees.filter((_, i) => i !== empIndex)
    const dismissedRosterEmployeeIds = removed?.rosterEmployeeId
      ? Array.from(
          new Set([...(s.plan.dismissedRosterEmployeeIds ?? []), removed.rosterEmployeeId]),
        )
      : s.plan.dismissedRosterEmployeeIds ?? []
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
    set({ plan: { ...s.plan, employees, cells, todos, pool, dismissedRosterEmployeeIds } })
    scheduleSave()
  },

  addTodo: (empIndex, week) => {
    const s = get()
    if (!s.plan) return
    const k = cellKey(empIndex, week)
    const current = s.plan.todos?.[k] ?? []
    const todo: WeekTodo = { id: newId(), text: '', state: 'offen' }
    const todos = { ...(s.plan.todos ?? {}), [k]: [...current, todo] }
    set({ plan: { ...s.plan, todos } })
    log('todo.add', `KW ${week} · ${empLabel(s.plan, empIndex)}`)
    scheduleSave()
  },

  updateTodo: (empIndex, week, id, patch) => {
    const s = get()
    if (!s.plan) return
    const k = cellKey(empIndex, week)
    const current = s.plan.todos?.[k] ?? []
    const next = current.map((t) => (t.id === id ? { ...t, ...patch } : t))
    const todos = { ...(s.plan.todos ?? {}), [k]: next }
    set({ plan: { ...s.plan, todos } })
    const changed = Object.keys(patch).join(',')
    log(
      `todo.update.${changed || 'any'}`,
      `KW ${week} · ${empLabel(s.plan, empIndex)}`,
    )
    scheduleSave()
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
    log('todo.remove', `KW ${week} · ${empLabel(s.plan, empIndex)}`)
    scheduleSave()
  },

  addPoolTask: (empIndex, text = '') => {
    const s = get()
    if (!s.plan) return
    const pool = [...(s.plan.pool ?? []), { id: newId(), text, empIndex }]
    set({ plan: { ...s.plan, pool } })
    log('pool.add', empLabel(s.plan, empIndex))
    scheduleSave()
  },

  updatePoolTask: (id, text) => {
    const s = get()
    if (!s.plan) return
    const pool = (s.plan.pool ?? []).map((t) => (t.id === id ? { ...t, text } : t))
    set({ plan: { ...s.plan, pool } })
    log('pool.update', id)
    scheduleSave()
  },

  removePoolTask: (id) => {
    const s = get()
    if (!s.plan) return
    const pool = (s.plan.pool ?? []).filter((t) => t.id !== id)
    set({ plan: { ...s.plan, pool } })
    log('pool.remove', id)
    scheduleSave()
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
    log(
      'pool.assign',
      `KW ${week} · ${empLabel(s.plan, poolEntry.empIndex)}`,
    )
    scheduleSave()
  },

  moveTodo: (from, to, todoId, toIndex) => {
    const s = get()
    if (!s.plan) return
    const fromKey = cellKey(from.empIndex, from.week)
    const fromList = s.plan.todos?.[fromKey] ?? []
    const todo = fromList.find((t) => t.id === todoId)
    if (!todo) return
    const todos = { ...(s.plan.todos ?? {}) }

    if (from.empIndex === to.empIndex && from.week === to.week) {
      // In-cell reorder
      const next = fromList.filter((t) => t.id !== todoId)
      const clamped = Math.max(0, Math.min(toIndex, next.length))
      next.splice(clamped, 0, todo)
      todos[fromKey] = next
    } else {
      // Cross-cell move: drop from source, insert into target at toIndex.
      const newFrom = fromList.filter((t) => t.id !== todoId)
      if (newFrom.length === 0) delete todos[fromKey]
      else todos[fromKey] = newFrom
      const toKey = cellKey(to.empIndex, to.week)
      const toList = [...(s.plan.todos?.[toKey] ?? [])]
      const clamped = Math.max(0, Math.min(toIndex, toList.length))
      toList.splice(clamped, 0, todo)
      todos[toKey] = toList
    }

    set({ plan: { ...s.plan, todos } })
    const isReorder = from.empIndex === to.empIndex && from.week === to.week
    log(
      isReorder ? 'todo.reorder' : 'todo.move',
      isReorder
        ? `KW ${from.week} · ${empLabel(s.plan, from.empIndex)}`
        : `${empLabel(s.plan, from.empIndex)} KW ${from.week} → ${empLabel(
            s.plan,
            to.empIndex,
          )} KW ${to.week}`,
    )
    scheduleSave()
  },

  moveAllTodos: (fromEmpIndex, toEmpIndex) => {
    const s = get()
    if (!s.plan || fromEmpIndex === toEmpIndex) return
    const todos: Record<string, WeekTodo[]> = { ...(s.plan.todos ?? {}) }
    const sourceKeys = Object.keys(todos).filter((k) => Number(k.split(':')[0]) === fromEmpIndex)
    for (const k of sourceKeys) {
      const [, wStr] = k.split(':')
      const sourceList = todos[k]
      delete todos[k]
      const toKey = cellKey(toEmpIndex, Number(wStr))
      todos[toKey] = [...(todos[toKey] ?? []), ...sourceList]
    }
    const pool: PoolTask[] = (s.plan.pool ?? []).map((t) =>
      t.empIndex === fromEmpIndex ? { ...t, empIndex: toEmpIndex } : t,
    )
    set({ plan: { ...s.plan, todos, pool } })
    log(
      'todo.move.all',
      `${empLabel(s.plan, fromEmpIndex)} → ${empLabel(s.plan, toEmpIndex)}`,
    )
    scheduleSave()
  },
  }
})
