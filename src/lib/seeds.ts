import type {
  MonthValues,
  Umsatzkontrolle,
  UmsatzTeam,
  Ziele,
  ZielePerson,
} from '@/types'

function person(name: string, fte: number, role?: ZielePerson['role']): ZielePerson {
  return { id: crypto.randomUUID(), name, fte, role }
}

export function defaultZiele(year: number): Ziele {
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

export function defaultUmsatz(year: number): Umsatzkontrolle {
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
