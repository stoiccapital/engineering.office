import type {
  ActivityEvent,
  Period,
  ProjekteDoc,
  ProjektlisteDoc,
  PlanStatus,
  QuartalPlan,
  Quarter,
  ProjectRow,
  WeekTodo,
  Employee,
  Ziele,
  Umsatzkontrolle,
  Rechnungsplan,
  Roster,
  AccessConfig,
} from './types'
import {
  emptyAccessConfig,
  emptyRechnungsplan,
  rechnungsplanKey,
} from './types'
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

const LOC_DE = 'loc-de'
const LOC_PL = 'loc-pl'
const TEAM_BRUECKEN = 'team-de-bruecken'
const TEAM_TRAGWERK = 'team-de-tragwerk'
const TEAM_ENERGIE = 'team-de-energie'
const TEAM_STATYKA = 'team-pl-statyka'
const TEAM_PRUEFUNG = 'team-pl-pruefung'

function seedRoster(): Roster {
  return {
    locations: [
      { id: LOC_DE, name: 'Deutschland' },
      { id: LOC_PL, name: 'Polen' },
    ],
    teams: [
      { id: TEAM_BRUECKEN, name: 'Brücken',  locationId: LOC_DE, color: '#2563eb' },
      { id: TEAM_TRAGWERK, name: 'Tragwerk', locationId: LOC_DE, color: '#16a34a' },
      { id: TEAM_ENERGIE,  name: 'Energie',  locationId: LOC_DE, color: '#d97706' },
      { id: TEAM_STATYKA,  name: 'Statyka',  locationId: LOC_PL, color: '#db2777' },
      { id: TEAM_PRUEFUNG, name: 'Prüfung',  locationId: LOC_PL, color: '#7c3aed' },
    ],
    employees: [
      { id: 'emp-admin', vorname: 'Admin',      name: '',             teamId: TEAM_BRUECKEN, kuerzel: 'admin', password: 'admin', roleId: 'dev-admin' },
      { id: 'emp-de-01', vorname: 'Matthias',   name: 'Merkin',       teamId: TEAM_BRUECKEN },
      { id: 'emp-de-02', vorname: 'Sophie',     name: 'Hartmann',     teamId: TEAM_BRUECKEN },
      { id: 'emp-de-03', vorname: 'Lukas',      name: 'Becker',       teamId: TEAM_BRUECKEN },
      { id: 'emp-de-04', vorname: 'Thomas',     name: 'Völker',       teamId: TEAM_TRAGWERK },
      { id: 'emp-de-05', vorname: 'Robert',     name: 'Fischer',      teamId: TEAM_TRAGWERK },
      { id: 'emp-de-06', vorname: 'Birgit',     name: 'Weiß',         teamId: TEAM_TRAGWERK },
      { id: 'emp-de-07', vorname: 'Daniel',     name: 'Keller',       teamId: TEAM_ENERGIE },
      { id: 'emp-de-08', vorname: 'Franziska',  name: 'Schulz',       teamId: TEAM_ENERGIE },
      { id: 'emp-pl-01', vorname: 'Adam',       name: 'Kowalski',     teamId: TEAM_STATYKA },
      { id: 'emp-pl-02', vorname: 'Jakub',      name: 'Wiśniewski',   teamId: TEAM_STATYKA },
      { id: 'emp-pl-03', vorname: 'Piotr',      name: 'Zieliński',    teamId: TEAM_STATYKA },
      { id: 'emp-pl-04', vorname: 'Katarzyna',  name: 'Nowak',        teamId: TEAM_PRUEFUNG },
      { id: 'emp-pl-05', vorname: 'Marek',      name: 'Lewandowski',  teamId: TEAM_PRUEFUNG },
    ],
  }
}

function seedPlan(year: number): QuartalPlan {
  const r = roster ?? seedRoster()
  const teamLoc = new Map(r.teams.map((t) => [t.id, t.locationId]))
  const employees: Employee[] = r.employees.map((e) => ({
    id: crypto.randomUUID(),
    name: [e.vorname, e.name].filter((s) => s.trim().length > 0).join(' '),
    branch: teamLoc.get(e.teamId ?? '') === LOC_PL ? 'pl' : 'de',
    rosterEmployeeId: e.id,
  }))
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
  todos[`8:${w + 2}`] = [{ id: crypto.randomUUID(), text: 'Urlaub Zakopane', state: 'offen' }]
  return { year, employees, cells, todos }
}

function seedRechnungsplan(year: number, month: number): Rechnungsplan {
  const plan = emptyRechnungsplan(year, month)
  plan.rows = [
    {
      id: crypto.randomUUID(),
      projNr: '26D001',
      projektname: 'A4 Brückenprüfung Köln',
      pl: 'MuA',
      deStatus: 'rgGestellt',
      plBranch: 'ja',
      hv: { status: 'rgGestellt', datum: `${year}-${String(month).padStart(2, '0')}-10` },
      nachtraege: [
        { status: 'aktuell' },
        { status: 'nichtRelevant' },
        { status: 'nichtRelevant' },
        { status: 'nichtRelevant' },
        { status: 'nichtRelevant' },
      ],
      zeithonorar: undefined,
      rgSummeDE: 92_000,
      rgSummePL: 18_000,
      nachtragErbracht: null,
      notes: { bemerkung1: 'Erste Teilrechnung', bemerkung2: '', fragen: '' },
    },
    {
      id: crypto.randomUUID(),
      projNr: '26D002',
      projektname: 'Umspannwerk Reisholz',
      pl: 'SuJ',
      deStatus: 'aktuell',
      plBranch: 'nein',
      hv: { status: 'aktuell' },
      nachtraege: [
        { status: 'aktuell' },
        { status: 'neu' },
        { status: 'nichtRelevant' },
        { status: 'nichtRelevant' },
        { status: 'nichtRelevant' },
      ],
      zeithonorar: undefined,
      rgSummeDE: null,
      rgSummePL: null,
      nachtragErbracht: null,
      notes: { bemerkung1: '', bemerkung2: '', fragen: 'Wann wird N02 beauftragt?' },
    },
  ]
  return plan
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
const rechnungsplaene = new Map<string, Rechnungsplan>()
let logo: string | null = null
let roster: Roster | null = seedRoster()
let kostenschaetzung: unknown = null
let kostenermittlung: unknown = null
let hr: unknown = null
let projects: ProjekteDoc | null = null
let projektliste: ProjektlisteDoc | null = null
const activity: ActivityEvent[] = []
let access: AccessConfig | null = (() => {
  const cfg = emptyAccessConfig()
  cfg.roles = [
    {
      id: 'dev-admin',
      name: 'Admin (dev)',
      password: 'admin',
      modules: ['dashboard', 'forecast', 'plan', 'plan_overview', 'ziele_dashboard', 'ziele_teams', 'ziele_kontrolle', 'rechnungen', 'projekte', 'projektliste', 'ks_bauwerke', 'ks_hoai', 'ks_katalog', 'ke_positionen', 'ke_uebersicht', 'ke_datenbank', 'hr_zeiterfassung', 'hr_gespraeche', 'hr_team_view', 'mitarbeiter', 'settings'],
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
  rechnungsplan(year: number, month: number): Rechnungsplan {
    const key = rechnungsplanKey(year, month)
    let r = rechnungsplaene.get(key)
    if (!r) {
      r = seedRechnungsplan(year, month)
      rechnungsplaene.set(key, r)
    }
    return r
  },
  setRechnungsplan(year: number, month: number, value: Rechnungsplan) {
    rechnungsplaene.set(rechnungsplanKey(year, month), value)
  },
  access(): AccessConfig | null {
    return access
  },
  setAccess(value: AccessConfig) {
    access = value
  },
  roster(): Roster | null {
    return roster
  },
  setRoster(value: Roster) {
    roster = value
  },
  kostenschaetzung(): unknown {
    return kostenschaetzung
  },
  setKostenschaetzung(value: unknown) {
    kostenschaetzung = value
  },
  kostenermittlung(): unknown {
    return kostenermittlung
  },
  setKostenermittlung(value: unknown) {
    kostenermittlung = value
  },
  hr(): unknown {
    return hr
  },
  setHr(value: unknown) {
    hr = value
  },
  projects(): ProjekteDoc | null {
    return projects
  },
  setProjects(value: ProjekteDoc) {
    projects = value
  },
  projektliste(): ProjektlisteDoc | null {
    return projektliste
  },
  setProjektliste(value: ProjektlisteDoc) {
    projektliste = value
  },
  activityList(days: number): ActivityEvent[] {
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - days)
    const cutoffIso = cutoff.toISOString()
    return activity
      .filter((e) => e.ts >= cutoffIso)
      .slice()
      .sort((a, b) => (a.ts < b.ts ? 1 : -1))
  },
  logActivity(event: Omit<ActivityEvent, 'ts'>) {
    activity.push({ ...event, ts: new Date().toISOString() })
    if (activity.length > 5000) activity.splice(0, activity.length - 5000)
  },
}
