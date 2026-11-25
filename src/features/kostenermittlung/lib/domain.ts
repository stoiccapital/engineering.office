import type {
  Ermittlungsart,
  Kostenermittlung,
  KostenermittlungWorkspace,
  Position,
  Projektkopf,
} from '../types'

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
    projekt: '',
    projektnummer: '',
    auftraggeber: 'DB InfraGO AG',
    ermittlungsart: 'Kostenschätzung',
    bearbeitetVon: '',
    datum: todayISO(),
    projektpreisstand: currentQuartal(),
    umsatzsteuer: 0.19,
  }
}

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

export function emptyProject(projektId: string): Kostenermittlung {
  return { projektId, kopf: emptyKopf(), positionen: [] }
}

export function emptyWorkspace(): KostenermittlungWorkspace {
  return { projects: [], activeProjektId: null }
}

function normalizeProject(raw: unknown, projektId: string): Kostenermittlung {
  const src = (raw ?? {}) as Partial<Kostenermittlung>
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
  return { projektId, kopf, positionen, updatedAt: src.updatedAt }
}

// Legacy single-doc shape: `{ kopf, positionen }` with no `projects` array.
// Wrapped as one orphan project so data is never lost — the user can map it
// to a Projektliste row later.
const LEGACY_ORPHAN_ID_PREFIX = 'legacy:'

export function normalizeWorkspace(raw: unknown): KostenermittlungWorkspace {
  const src = (raw ?? {}) as Partial<KostenermittlungWorkspace> &
    Partial<Kostenermittlung>
  const isLegacy =
    !Array.isArray((src as any).projects) &&
    ('kopf' in src || 'positionen' in src)
  if (isLegacy) {
    const orphanId = `${LEGACY_ORPHAN_ID_PREFIX}${genId()}`
    const legacy = normalizeProject(src, orphanId)
    return {
      projects: [legacy],
      activeProjektId: orphanId,
      updatedAt: src.updatedAt,
    }
  }
  const rawProjects = Array.isArray((src as any).projects)
    ? ((src as any).projects as Array<Partial<Kostenermittlung>>)
    : []
  const seen = new Set<string>()
  const projects: Kostenermittlung[] = []
  for (const p of rawProjects) {
    const id =
      typeof p?.projektId === 'string' && p.projektId.length > 0
        ? p.projektId
        : `${LEGACY_ORPHAN_ID_PREFIX}${genId()}`
    if (seen.has(id)) continue
    seen.add(id)
    projects.push(normalizeProject(p, id))
  }
  const activeProjektId =
    typeof src.activeProjektId === 'string' &&
    projects.some((p) => p.projektId === src.activeProjektId)
      ? src.activeProjektId
      : null
  return { projects, activeProjektId, updatedAt: src.updatedAt }
}

export function isLegacyOrphan(projektId: string): boolean {
  return projektId.startsWith(LEGACY_ORPHAN_ID_PREFIX)
}
