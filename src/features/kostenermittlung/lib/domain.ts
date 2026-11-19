import type { Ermittlungsart, Kostenermittlung, Position, Projektkopf } from '../types'

const ERMITTLUNGSARTEN: Ermittlungsart[] = [
  'Kostenschätzung',
  'Kostenberechnung',
  'Kostenanschlag',
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function currentQuartal(): string {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3) + 1
  return `Q${q}/${d.getFullYear()}`
}

export function emptyKopf(): Projektkopf {
  return {
    projekt: 'Musterprojekt',
    projektnummer: '',
    auftraggeber: 'DB InfraGO AG',
    ermittlungsart: 'Kostenschätzung',
    bearbeitetVon: '',
    datum: todayISO(),
    projektpreisstand: currentQuartal(),
    umsatzsteuer: 0.19,
  }
}

export function emptyDoc(): Kostenermittlung {
  return { kopf: emptyKopf(), positionen: [] }
}

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

export function normalize(doc: unknown): Kostenermittlung {
  const src = (doc ?? {}) as Partial<Kostenermittlung>
  const kopf = { ...emptyKopf(), ...(src.kopf ?? {}) }
  if (!ERMITTLUNGSARTEN.includes(kopf.ermittlungsart)) {
    kopf.ermittlungsart = 'Kostenschätzung'
  }
  const positionen: Position[] = (src.positionen ?? []).map((p) => ({
    id: p.id ?? genId(),
    kgk: p.kgk ?? null,
    hauptgruppe: (p.hauptgruppe ?? 1) as Position['hauptgruppe'],
    text: p.text ?? '',
    anmerkung: p.anmerkung ?? null,
    menge: p.menge ?? 0,
    einheit: p.einheit ?? '',
    einheitspreis: p.einheitspreis ?? 0,
    erlaeuterung: p.erlaeuterung ?? null,
  }))
  return { kopf, positionen }
}
