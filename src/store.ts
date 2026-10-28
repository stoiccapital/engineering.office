import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Period, ProjectRow, Quarter, RiskFlag } from './types'

const CURRENT_YEAR = new Date().getFullYear()

function emptyRow(): ProjectRow {
  return {
    id: crypto.randomUUID(),
    projektleiterDE: '',
    projektleiterPL: '',
    projektname: '',
    projNr: '',
    leistung: '',
    forecastDE: null,
    flagDE: 'w',
    forecastPL: null,
    flagPL: 'w',
    abgerechnetDE: null,
    abgerechnetPL: null,
    leistungsstandDE: null,
    leistungsstandPL: null,
  }
}

function seedRow(partial: Partial<ProjectRow>): ProjectRow {
  return { ...emptyRow(), ...partial }
}

function seedPeriod(year: number, quarter: Quarter): Period {
  return { year, quarter, rows: [emptyRow(), emptyRow(), emptyRow()] }
}

function periodKey(year: number, quarter: Quarter): string {
  return `${year}-${quarter}`
}

type State = {
  year: number
  quarter: Quarter
  periods: Record<string, Period>
  setYear: (y: number) => void
  setQuarter: (q: Quarter) => void
  currentPeriod: () => Period
  addRow: () => void
  updateRow: (id: string, patch: Partial<ProjectRow>) => void
  deleteRow: (id: string) => void
  setFlag: (id: string, which: 'flagDE' | 'flagPL', flag: RiskFlag) => void
}

export const useForecast = create<State>()(
  persist(
    (set, get) => ({
      year: CURRENT_YEAR,
      quarter: 'Q1',
      periods: {
        [periodKey(CURRENT_YEAR, 'Q1')]: {
          year: CURRENT_YEAR,
          quarter: 'Q1',
          rows: [
            seedRow({
              projektleiterDE: 'MuA',
              projektleiterPL: 'KnD',
              projektname: 'Tegernseer Platz',
              projNr: '26D055',
              leistung: 'Lph04 und Lph05 zu 100% abschließen',
              forecastDE: 55000,
              flagDE: 'w',
              forecastPL: 25000,
              flagPL: 'w',
              leistungsstandDE: 0.3,
              leistungsstandPL: 0.2,
            }),
            seedRow({
              projektleiterDE: 'SuJ',
              projektname: 'Passau Tunnel',
              projNr: '26D056',
              leistung: 'Lph01 und Lph02 zu 100% abschließen',
              forecastDE: 100000,
              flagDE: 'k',
              leistungsstandDE: 0.5,
            }),
            seedRow({
              projektleiterDE: 'MuA',
              projektname: 'Schöpfwerk Großenbrode',
              projNr: '26D057',
              leistung: 'Lph01 bis Lph03 zu 100% abschließen',
              forecastDE: 50000,
              flagDE: 'w',
              leistungsstandDE: 0.5,
            }),
            seedRow({
              projektleiterDE: 'SuJ',
              projektleiterPL: 'WeT',
              projektname: 'ESTW E-Dellwig SIA EP',
              projNr: '26D058',
              leistung: 'Lph01 bis Lph03 zu 100% und Lph04 bis Lph06 zu 80% abschließen',
              forecastDE: 30000,
              flagDE: 'w',
              forecastPL: 20000,
              flagPL: 'w',
              leistungsstandDE: 0.1,
              leistungsstandPL: 0.08,
            }),
          ],
        },
      },
      setYear: (y) =>
        set((s) => {
          const key = periodKey(y, s.quarter)
          const periods = { ...s.periods }
          if (!periods[key]) periods[key] = seedPeriod(y, s.quarter)
          return { year: y, periods }
        }),
      setQuarter: (q) =>
        set((s) => {
          const key = periodKey(s.year, q)
          const periods = { ...s.periods }
          if (!periods[key]) periods[key] = seedPeriod(s.year, q)
          return { quarter: q, periods }
        }),
      currentPeriod: () => {
        const s = get()
        const key = periodKey(s.year, s.quarter)
        return s.periods[key] ?? seedPeriod(s.year, s.quarter)
      },
      addRow: () =>
        set((s) => {
          const key = periodKey(s.year, s.quarter)
          const p = s.periods[key] ?? seedPeriod(s.year, s.quarter)
          return {
            periods: {
              ...s.periods,
              [key]: { ...p, rows: [...p.rows, emptyRow()] },
            },
          }
        }),
      updateRow: (id, patch) =>
        set((s) => {
          const key = periodKey(s.year, s.quarter)
          const p = s.periods[key]
          if (!p) return s
          return {
            periods: {
              ...s.periods,
              [key]: {
                ...p,
                rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
              },
            },
          }
        }),
      deleteRow: (id) =>
        set((s) => {
          const key = periodKey(s.year, s.quarter)
          const p = s.periods[key]
          if (!p) return s
          return {
            periods: {
              ...s.periods,
              [key]: { ...p, rows: p.rows.filter((r) => r.id !== id) },
            },
          }
        }),
      setFlag: (id, which, flag) =>
        set((s) => {
          const key = periodKey(s.year, s.quarter)
          const p = s.periods[key]
          if (!p) return s
          return {
            periods: {
              ...s.periods,
              [key]: {
                ...p,
                rows: p.rows.map((r) => (r.id === id ? { ...r, [which]: flag } : r)),
              },
            },
          }
        }),
    }),
    { name: 'forecast-store-v1' },
  ),
)
