import { create } from 'zustand'
import type { Period, Quarter } from './types'
import { fetchPeriod } from './api'
import { QUARTERS } from './lib/analytics'

const CURRENT_YEAR = new Date().getFullYear()

type Status = 'idle' | 'loading' | 'loaded' | 'error'

type State = {
  year: number
  quarter: Quarter
  periods: Partial<Record<Quarter, Period | null>>
  status: Status
  error: string | null
  setYear: (y: number) => void
  setQuarter: (q: Quarter) => void
  load: () => Promise<void>
}

export const useDashboard = create<State>()((set, get) => ({
  year: CURRENT_YEAR,
  quarter: 'Q1',
  periods: {},
  status: 'idle',
  error: null,

  setYear: (y) => {
    set({ year: y, periods: {}, status: 'idle' })
    void get().load()
  },

  setQuarter: (q) => set({ quarter: q }),

  load: async () => {
    const s = get()
    set({ status: 'loading', error: null })
    try {
      const entries = await Promise.all(
        QUARTERS.map(async (q) => [q, await fetchPeriod(`${s.year}-${q}`)] as const),
      )
      const periods: Partial<Record<Quarter, Period | null>> = {}
      for (const [q, p] of entries) periods[q] = p
      set({ periods, status: 'loaded' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },
}))
