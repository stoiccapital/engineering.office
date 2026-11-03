import type { Umsatzkontrolle, Ziele, ZielePerson } from '@/types'

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

// Teams, FTE, and ziel are now owned by Ziele. defaultUmsatz starts empty;
// the merge layer lights up every Ziele team with zero operational data until
// the PM fills in Forecast / Rechnungen.
export function defaultUmsatz(year: number): Umsatzkontrolle {
  return { year, teams: [] }
}
