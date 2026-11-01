import type {
  Period,
  PlanStatus,
  QuartalPlan,
  Quarter,
  ProjectRow,
  WeekTodo,
  Ziele,
  ZielePerson,
  Umsatzkontrolle,
  UmsatzTeam,
  MonthValues,
} from './types'

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
  const employees = ['M. Merkin', 'T. Völker', 'A. Kowalski', 'K. Nowak', 'J. Wiśniewski']
  const cells: Record<string, PlanStatus> = {}
  const todos: Record<string, WeekTodo[]> = {}
  const w = currentIsoWeek()
  todos[`0:${w}`] = [
    { id: crypto.randomUUID(), text: 'Aufgabe: Prüfbericht A4 fertigstellen', done: false },
    { id: crypto.randomUUID(), text: 'Abstimmen mit Bauleitung Köln', done: false },
  ]
  todos[`1:${w}`] = [
    { id: crypto.randomUUID(), text: 'Aufgabe: Statik 26D002 Kickoff', done: false },
    { id: crypto.randomUUID(), text: 'Rechnung 26D001 — Teil 2', done: true },
  ]
  todos[`2:${w + 1}`] = [{ id: crypto.randomUUID(), text: 'Urlaub Mallorca', done: false }]
  todos[`3:${w}`] = [
    { id: crypto.randomUUID(), text: 'Abstimmen Prüfstatik mit Dezernat', done: false },
  ]
  todos[`4:${w + 2}`] = [{ id: crypto.randomUUID(), text: 'Urlaub Zakopane', done: false }]
  return { year, employees, cells, todos }
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

function person(name: string, fte: number, role?: ZielePerson['role']): ZielePerson {
  return { id: crypto.randomUUID(), name, fte, role }
}

function seedZiele(year: number): Ziele {
  return {
    year,
    branches: [
      {
        id: 'de',
        label: 'NL DE',
        umsatzProFTE: 160_000,
        ruhendePct: 0.4,
        teams: [
          {
            id: crypto.randomUUID(),
            name: 'Team MNZ',
            people: [
              person('Alberon, Mulaj', 1),
              person('Jonas, Suhr', 1),
              person('Matthias, Maier', 1),
              person('Tobias, Gaede', 0.4),
              person('Hans, Zech', 0.4),
              person('Justus, Erhardt', 0.4),
              person('Johannes, Wüst', 0.3),
              person('Andreas, Bucher', 0.6),
              person('Martina, Kaiser', 0.6),
              person('Zusätzlicher MA', 0.5),
            ],
          },
          {
            id: crypto.randomUUID(),
            name: 'Team Maier',
            people: [
              person('Alois, Maier', 1),
              person('Jörg, Terblanche', 1),
              person('Kilian, Schwimmer', 1),
              person('Selina, Stocker', 1),
              person('Sinan, Gülenci', 0.4),
              person('Niklas, Berger', 0.4),
              person('Martin, Piko', 0.6),
              person('Antonia, Steber', 0.8),
              person('Magdalena, Maciol', 0.8),
              person('Zusätzlicher MA', 0.5),
            ],
          },
          {
            id: crypto.randomUUID(),
            name: 'Ausschreibung',
            people: [person('Ausschreibung', 1, 'ausschreibung')],
          },
          {
            id: crypto.randomUUID(),
            name: 'Verwaltung',
            people: [person('Verwaltung', 2, 'verwaltung')],
          },
        ],
      },
      {
        id: 'pl',
        label: 'NL PL',
        umsatzProFTE: 112_000,
        ruhendePct: 0.4,
        teams: [
          {
            id: crypto.randomUUID(),
            name: 'Team Multitask',
            people: [
              person('Dawid, Knapik', 1),
              person('Hubert, Nowicki', 1),
              person('Karolina, Skoczylas', 1),
              person('Paulina, Redzio', 1),
              person('Zusätzlicher MA', 0),
            ],
          },
          {
            id: crypto.randomUUID(),
            name: 'Team AAA',
            people: [
              person('Toni, Werwinski', 1),
              person('Dariusz, Zimny', 1),
              person('Dorota, Smaga', 1),
              person('Piotr, Stolarek', 1),
              person('Kinga, Browska', 1),
              person('Magdalena, Kozlowska', 1),
              person('Patryk, Knapik', 1),
              person('Zusätzlicher MA', 0),
            ],
          },
          {
            id: crypto.randomUUID(),
            name: 'Verwaltung',
            people: [person('Verwaltung', 1, 'verwaltung')],
          },
        ],
      },
    ],
  }
}

function monthly(values: (number | null)[]): MonthValues {
  const out: MonthValues = Array.from({ length: 12 }, () => null)
  for (let i = 0; i < 12 && i < values.length; i++) out[i] = values[i]
  return out
}

function umsatzTeam(
  name: string,
  branch: UmsatzTeam['branch'],
  fte: number,
  forecast: (number | null)[],
  rechnungen: (number | null)[],
  ziel: (number | null)[],
): UmsatzTeam {
  return {
    id: crypto.randomUUID(),
    name,
    branch,
    fte,
    forecast: monthly(forecast),
    rechnungen: monthly(rechnungen),
    ziel: monthly(ziel),
  }
}

function seedUmsatz(year: number): Umsatzkontrolle {
  return {
    year,
    teams: [
      umsatzTeam(
        'Team MNZ',
        'de',
        6.2,
        [103000, 103000, 103000, 62700, 62700, 62700, 103000, 103000, 103000, 166667, 166667, 166667],
        [89071, 141241, 188730, 84305, 101277, 179204, 153261, 143840, 204382, null, null, null],
        [104000, 104000, 104000, 104000, 104000, 104000, 109333, 109333, 109333, 109333, 109333, 109333],
      ),
      umsatzTeam(
        'Team Multitask',
        'pl',
        4,
        [40000, 40000, 40000, 44633, 44633, 44633, 40000, 40000, 40000, 60667, 60667, 60667],
        [40575, 41148, 65849, 97339, 21830, 25873, 58849, 46277, 36435, null, null, null],
        [41067, 41067, 41067, 41067, 41067, 41067, 41067, 41067, 41067, 41067, 41067, 41067],
      ),
      umsatzTeam(
        'Team ToDo',
        'pl',
        7,
        [60000, 60000, 60000, 121667, 121667, 121667, 60000, 60000, 60000, 24667, 24667, 24667],
        [61476, 67190, 138575, 50362, 40130, 116323, 116849, 34425, 174179, null, null, null],
        [67317, 67317, 67317, 67317, 67317, 67317, 67317, 67317, 67317, 67317, 67317, 67317],
      ),
    ],
  }
}

const periods = new Map<string, Period>()
const plans = new Map<number, QuartalPlan>()
const ziele = new Map<number, Ziele>()
const umsatz = new Map<number, Umsatzkontrolle>()
let logo: string | null = null

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
      z = seedZiele(year)
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
      u = seedUmsatz(year)
      umsatz.set(year, u)
    }
    return u
  },
  setUmsatz(year: number, value: Umsatzkontrolle) {
    umsatz.set(year, value)
  },
}
