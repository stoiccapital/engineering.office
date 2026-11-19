// Lazy loader for the two Ril-808 catalogs.
//
// The JSON files total ~2 MB raw. We load them on first access via dynamic
// import so the main bundle stays small and other tabs (Projekt, Übersicht,
// Dashboard etc.) don't pay for them.

export type KgkEntry = {
  code: string
  ebene: number
  bezeichnung: string
  einheit: string | null
  anmerkung: string | null
  pfad: string | null
  codeInQuelle: string | null
  parent: string | null
  kostengliederung: string | null
  ebene1: string | null
  ebene2: string | null
  ebene3: string | null
  ebene4: string | null
  ebene5: string | null
  ebene6: string | null
  faktor: number | null
  epVon: number | null
  epBis: number | null
  epEinheit: string | null
  epAktuellVon: number | null
  epAktuellBis: number | null
  epAktuellEinheit: string | null
}

export type FreiEntry = {
  id: number
  bezeichnung: string
  anmerkung: string | null
  betrag: number | null
  einheit: string | null
}

export type KatalogMeta = {
  quartal: string
  faktor: number
  quelle: string
  kgkCount: number
  freiCount: number
  kgkMitPreis: number
  freiMitPreis: number
}

export type Katalog = {
  meta: KatalogMeta
  kgk: KgkEntry[]
  frei: FreiEntry[]
  kgkByCode: Map<string, KgkEntry>
}

let cached: Katalog | null = null
let loading: Promise<Katalog> | null = null

export async function loadKatalog(): Promise<Katalog> {
  if (cached) return cached
  if (loading) return loading
  loading = (async () => {
    const [metaMod, kgkMod, freiMod] = await Promise.all([
      import('../data/katalogMeta.json'),
      import('../data/katalog_kgk.json'),
      import('../data/katalog_frei.json'),
    ])
    const meta = metaMod.default as KatalogMeta
    const kgk = kgkMod.default as KgkEntry[]
    const frei = freiMod.default as FreiEntry[]
    const kgkByCode = new Map(kgk.map((e) => [e.code, e]))
    cached = { meta, kgk, frei, kgkByCode }
    loading = null
    return cached
  })()
  return loading
}

export function cachedKatalog(): Katalog | null {
  return cached
}

// Default price inserted into a position when picking a KGK-DB entry.
// EP-ranges use the midpoint — matches what a PM would guess as "mittelwert".
export function defaultPrice(entry: KgkEntry): number {
  if (entry.epVon !== null && entry.epBis !== null) {
    return (entry.epVon + entry.epBis) / 2
  }
  return entry.epVon ?? entry.epBis ?? 0
}

// Fast substring search with token-AND over bezeichnung + pfad + code.
// Called from the picker on every keystroke — kept allocation-free.
function haystackKgk(e: KgkEntry): string {
  return `${e.code} ${e.bezeichnung} ${e.pfad ?? ''}`.toLowerCase()
}

function haystackFrei(e: FreiEntry): string {
  return `${e.bezeichnung} ${e.anmerkung ?? ''}`.toLowerCase()
}

export function searchKgk(
  katalog: Katalog,
  query: string,
  { withPriceOnly = false, hauptgruppe }: { withPriceOnly?: boolean; hauptgruppe?: number } = {},
  limit = 300,
): KgkEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const out: KgkEntry[] = []
  for (const e of katalog.kgk) {
    if (withPriceOnly && e.epVon === null) continue
    if (hauptgruppe !== undefined && Number(e.code[0]) !== hauptgruppe) continue
    const hay = haystackKgk(e)
    if (terms.every((t) => hay.includes(t))) {
      out.push(e)
      if (out.length >= limit) break
    }
  }
  return out
}

export function searchFrei(
  katalog: Katalog,
  query: string,
  { withPriceOnly = true }: { withPriceOnly?: boolean } = {},
  limit = 300,
): FreiEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const out: FreiEntry[] = []
  for (const e of katalog.frei) {
    if (withPriceOnly && e.betrag === null) continue
    const hay = haystackFrei(e)
    if (terms.every((t) => hay.includes(t))) {
      out.push(e)
      if (out.length >= limit) break
    }
  }
  return out
}
