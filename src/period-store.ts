/**
 * Shared app-level year (docs/principles.md §1 — one source of truth).
 *
 * Today each data store (forecast, plan, ziele, umsatz, rechnungen) keeps
 * its own year. Users change year in one module and are surprised when
 * another module still shows a different one.
 *
 * This store holds the app-level year. App.tsx subscribes to it and pushes
 * the change into every per-module store via setYear. Quarter/month/halbjahr
 * stay per-module (different modules care about different resolutions and
 * users often want different quarters in different contexts).
 */
import { create } from 'zustand'

const CURRENT_YEAR = new Date().getFullYear()

interface PeriodState {
  year: number
  setYear: (y: number) => void
}

export const usePeriod = create<PeriodState>()((set) => ({
  year: CURRENT_YEAR,
  setYear: (y) => set({ year: y }),
}))
