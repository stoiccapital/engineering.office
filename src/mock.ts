import type {
  Period,
  PlanStatus,
  QuartalPlan,
  Quarter,
  ProjectRow,
  WeekTodo,
  Employee,
  Ziele,
  Umsatzkontrolle,
  RechnungenData,
  AccessConfig,
} from './types'
import { emptyAccessConfig } from './types'
import { defaultUmsatz, defaultZiele } from './lib/seeds'

const YEAR = new Date().getFullYear()

function row(
  patch: Partial<ProjectRow> & Pick<ProjectRow, 'projektname' | 'projNr'>,
): ProjectRow {
  return {
    id: crypto.randomUUID(),
    projektleiterDE: '',
    projektleiterPL: '',
    leistung: '',
    forecastDE: null,
    flagDE: 'w',
    forecastPL: null,
    flagPL: 'w',
    abgerechnetDE: null,
    abgerechnetPL: null,
    leistungsstandDE: null,
    leistungsstandPL: null,
    ...patch,
  }
}

function seedPeriod(year: number, quarter: Quarter): Period {
  return {
    year,
    quarter,
    rows: [
      row({
        projektleiterDE: 'Merkin',
        projektleiterPL: 'Kowalski',
        projektname: 'Autobahn A4 — Brückenprüfung Köln',
        projNr: '26D001',
        leistung: 'Statische Hauptprüfung nach DIN 1076',
        forecastDE: 184_000,
        flagDE: 'w',
        forecastPL: 42_000,
        flagPL: 'w',
        abgerechnetDE: 92_000,
        abgerechnetPL: 18_000,
        leistungsstandDE: 0.55,
        leistungsstandPL: 0.4,
      }),
      row({
        projektleiterDE: 'Völker',
        projektleiterPL: 'Nowak',
        projektname: 'Umspannwerk Düsseldorf-Reisholz — Erweiterung',
        projNr: '26D002',
        leistung: 'Tragwerksplanung Schaltanlage 110 kV',
        forecastDE: 310_000,
        flagDE: 'k',
        forecastPL: 68_000,
        flagPL: 'w',
        abgerechnetDE: 48_000,
        abgerechnetPL: 12_000,
        leistungsstandDE: 0.2,
        leistungsstandPL: 0.3,
      }),
      row({
        projektleiterDE: 'Merkin',
        projektleiterPL: '',
        projektname: 'Rheinhafen Krefeld — Kaimauer-Sanierung',
        projNr: '26D003',
        leistung: 'Baugrunduntersuchung + Sanierungskonzept',
        forecastDE: 96_500,
        flagDE: 'w',
        forecastPL: null,
        flagPL: 'w',
        abgerechnetDE: 96_500,
        abgerechnetPL: null,
        leistungsstandDE: 1,
        leistungsstandPL: null,
      }),
      row({
        projektleiterDE: 'Völker',
        projektleiterPL: 'Wiśniewski',
        projektname: 'Gewerbepark Essen-Nord — Erschließung',
        projNr: '26D004',
        leistung: 'Entwässerung + Leitungstiefbau',
        forecastDE: 72_000,
        flagDE: 'w',
        forecastPL: 24_000,
        flagPL: 'k',
        abgerechnetDE: 36_000,
        abgerechnetPL: 8_000,
        leistungsstandDE: 0.5,
        leistungsstandPL: 0.35,
      }),
      row({
        projektleiterDE: 'Merkin',
        projektleiterPL: 'Kowalski',
        projektname: 'Grundschule Mönchengladbach — Neubau Turnhalle',
        projNr: '26D005',
        leistung: 'Tragwerk Hallenbau, Prüfstatik',
        forecastDE: 48_000,
        flagDE: 'w',
        forecastPL: 14_000,
        flagPL: 'w',
        abgerechnetDE: 10_000,
        abgerechnetPL: null,
        leistungsstandDE: 0.15,
        leistungsstandPL: 0.1,
      }),
    ],
  }
}

function seedPlan(year: number): QuartalPlan {
  const employees: Employee[] = [
    { id: crypto.randomUUID(), name: 'M. Merkin',    branch: 'de' },
    { id: crypto.randomUUID(), name: 'T. Völker',    branch: 'de' },
    { id: crypto.randomUUID(), name: 'A. Kowalski',  branch: 'pl' },
    { id: crypto.randomUUID(), name: 'K. Nowak',     branch: 'pl' },
    { id: crypto.randomUUID(), name: 'J. Wiśniewski',branch: 'pl' },
  ]
  const cells: Record<string, PlanStatus> = {}
  const todos: Record<string, WeekTodo[]> = {}
  const w = currentIsoWeek()
  todos[`0:${w}`] = [
    { id: crypto.randomUUID(), text: 'Aufgabe: Prüfbericht A4 fertigstellen', state: 'inProgress' },
    { id: crypto.randomUUID(), text: 'Abstimmen mit Bauleitung Köln', state: 'offen' },
  ]
  todos[`1:${w}`] = [
    { id: crypto.randomUUID(), text: 'Aufgabe: Statik 26D002 Kickoff', state: 'offen' },
    { id: crypto.randomUUID(), text: 'Rechnung 26D001 — Teil 2', state: 'erledigt' },
  ]
  todos[`2:${w + 1}`] = [{ id: crypto.randomUUID(), text: 'Urlaub Mallorca', state: 'offen', days: [1, 2] }]
  todos[`3:${w}`] = [
    { id: crypto.randomUUID(), text: 'Abstimmen Prüfstatik mit Dezernat', state: 'inProgress' },
  ]
  todos[`4:${w + 2}`] = [{ id: crypto.randomUUID(), text: 'Urlaub Zakopane', state: 'offen' }]
  return { year, employees, cells, todos }
}

function seedRechnungen(year: number): RechnungenData {
  const d = (m: number, day: number) => `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return {
    year,
    rows: [
      { id: crypto.randomUUID(), nr: 'R-2026-001', datum: d(1, 15), kunde: 'Autobahn GmbH',       projekt: 'A4 Brückenprüfung',  netto: 92000, ustPct: 19, status: 'bezahlt',  faellig: d(2, 15), bezahltAm: d(2, 10), notiz: '' },
      { id: crypto.randomUUID(), nr: 'R-2026-002', datum: d(2, 5),  kunde: 'Stadtwerke Düsseldorf', projekt: 'Umspannwerk Reisholz', netto: 48000, ustPct: 19, status: 'offen',    faellig: d(3, 7),  bezahltAm: '', notiz: 'Erste Teilrechnung' },
      { id: crypto.randomUUID(), nr: 'R-2026-003', datum: d(2, 20), kunde: 'Hafen Krefeld',          projekt: 'Kaimauer-Sanierung',  netto: 96500, ustPct: 19, status: 'bezahlt',  faellig: d(3, 22), bezahltAm: d(3, 18), notiz: '' },
      { id: crypto.randomUUID(), nr: 'R-2026-004', datum: d(3, 10), kunde: 'Essen-Nord Grund',       projekt: 'Gewerbepark',         netto: 36000, ustPct: 19, status: 'mahnung',  faellig: d(4, 10), bezahltAm: '', notiz: '1. Mahnung versendet' },
    ],
  }
}

function currentIsoWeek(): number {
  const d = new Date()
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const diff = target.getTime() - firstThursday.getTime()
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000))
}

const periods = new Map<string, Period>()
const plans = new Map<number, QuartalPlan>()
const ziele = new Map<number, Ziele>()
const umsatz = new Map<number, Umsatzkontrolle>()
const rechnungen = new Map<number, RechnungenData>()
let logo: string | null = null
let access: AccessConfig | null = (() => {
  const cfg = emptyAccessConfig()
  cfg.roles = [
    {
      id: 'dev-admin',
      name: 'Admin (dev)',
      password: 'admin',
      modules: ['dashboard', 'forecast', 'plan', 'ziele', 'umsatz', 'rechnungen', 'settings'],
    },
  ]
  return cfg
})()

export const mock = {
  isDev: (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true,
  period(key: string): Period {
    let p = periods.get(key)
    if (!p) {
      const [yStr, q] = key.split('-')
      p = seedPeriod(Number(yStr) || YEAR, (q as Quarter) || 'Q4')
      periods.set(key, p)
    }
    return p
  },
  setPeriod(key: string, value: Period) {
    periods.set(key, value)
  },
  plan(year: number): QuartalPlan {
    let p = plans.get(year)
    if (!p) {
      p = seedPlan(year)
      plans.set(year, p)
    }
    return p
  },
  setPlan(year: number, value: QuartalPlan) {
    plans.set(year, value)
  },
  logo(): string | null {
    return logo
  },
  setLogo(value: string | null) {
    logo = value
  },
  ziele(year: number): Ziele {
    let z = ziele.get(year)
    if (!z) {
      z = defaultZiele(year)
      ziele.set(year, z)
    }
    return z
  },
  setZiele(year: number, value: Ziele) {
    ziele.set(year, value)
  },
  umsatz(year: number): Umsatzkontrolle {
    let u = umsatz.get(year)
    if (!u) {
      u = defaultUmsatz(year)
      umsatz.set(year, u)
    }
    return u
  },
  setUmsatz(year: number, value: Umsatzkontrolle) {
    umsatz.set(year, value)
  },
  rechnungen(year: number): RechnungenData {
    let r = rechnungen.get(year)
    if (!r) {
      r = seedRechnungen(year)
      rechnungen.set(year, r)
    }
    return r
  },
  setRechnungen(year: number, value: RechnungenData) {
    rechnungen.set(year, value)
  },
  access(): AccessConfig | null {
    return access
  },
  setAccess(value: AccessConfig) {
    access = value
  },
}
