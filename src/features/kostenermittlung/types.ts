// Shape of the "Kostenermittlung nach Ril 808" document — mirrors the Excel
// Vorlage (Projektkopf + flat positions list grouped by 8 DIN-276 Hauptgruppen).

export type Ermittlungsart = 'Kostenschätzung' | 'Kostenberechnung' | 'Kostenanschlag'

export type Projektkopf = {
  projekt: string
  projektnummer: string
  auftraggeber: string
  ermittlungsart: Ermittlungsart
  bearbeitetVon: string
  datum: string // YYYY-MM-DD
  projektpreisstand: string // e.g. "Q3/2026"
  umsatzsteuer: number | null // 0.19 default; null = USt. nicht anwenden
}

export type Position = {
  id: string
  // 7-digit KGK code; null while editing. First digit must match the
  // hauptgruppe (1..8) when valid.
  kgk: string | null
  hauptgruppe: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  text: string
  anmerkung: string | null
  menge: number
  einheit: string
  einheitspreis: number
  erlaeuterung: string | null
}

export type Kostenermittlung = {
  // ID of the owning Projektliste row — one Kostenermittlung per project.
  projektId: string
  kopf: Projektkopf
  positionen: Position[]
  updatedAt?: string
}

export type KostenermittlungWorkspace = {
  projects: Kostenermittlung[]
  activeProjektId: string | null
  updatedAt?: string
}
