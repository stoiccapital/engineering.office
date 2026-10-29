import { create } from 'zustand'
import type { PlanStatus, QuartalPlan } from './types'
import { fetchPlan, savePlan } from './api'

const CURRENT_YEAR = new Date().getFullYear()

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
  plan: QuartalPlan | null
  status: SaveStatus
  error: string | null
  setYear: (y: number) => void
  load: () => Promise<void>
  setCell: (empIndex: number, week: number, status: PlanStatus | null) => void
  renameEmployee: (empIndex: number, name: string) => void
  addEmployee: () => void
  removeEmployee: (empIndex: number) => void
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
  plan: null,
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
    set({ plan: { ...s.plan, employees, cells } })
    scheduleSave(get, (p) => set(p as Partial<State>))
  },
}))
