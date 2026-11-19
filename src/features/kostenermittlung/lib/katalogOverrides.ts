// User-maintained overlay on top of the bundled Ril-808 catalog. We never
// mutate the JSON files — any change persists in a separate KV doc and gets
// applied on top of the base at load time. This keeps the reference clean
// and makes a "reset" trivial (delete the overrides doc).

import type { FreiEntry, Katalog, KgkEntry } from './katalog'

export type KgkPatch = Partial<
  Pick<KgkEntry, 'bezeichnung' | 'anmerkung' | 'einheit' | 'epVon' | 'epBis' | 'epEinheit'>
>

export type FreiPatch = Partial<
  Pick<FreiEntry, 'bezeichnung' | 'anmerkung' | 'betrag' | 'einheit'>
>

export type KatalogOverrides = {
  // Edits to base KGK entries, keyed by code.
  kgkUpdates: Record<string, KgkPatch>
  // User-added KGK entries.
  kgkAdded: KgkEntry[]
  // Base KGK codes the user has soft-hidden.
  kgkHidden: string[]

  // Edits to base Freie entries, keyed by stable id.
  freiUpdates: Record<string, FreiPatch>
  // User-added Freie entries (always with their own id in a reserved range).
  freiAdded: FreiEntry[]
  // Base Freie ids the user has soft-hidden.
  freiHidden: number[]

  updatedAt?: string
}

export function emptyOverrides(): KatalogOverrides {
  return {
    kgkUpdates: {},
    kgkAdded: [],
    kgkHidden: [],
    freiUpdates: {},
    freiAdded: [],
    freiHidden: [],
  }
}

export function normalizeOverrides(raw: unknown): KatalogOverrides {
  const src = (raw ?? {}) as Partial<KatalogOverrides>
  return {
    kgkUpdates: src.kgkUpdates ?? {},
    kgkAdded: Array.isArray(src.kgkAdded) ? src.kgkAdded : [],
    kgkHidden: Array.isArray(src.kgkHidden) ? src.kgkHidden : [],
    freiUpdates: src.freiUpdates ?? {},
    freiAdded: Array.isArray(src.freiAdded) ? src.freiAdded : [],
    freiHidden: Array.isArray(src.freiHidden) ? src.freiHidden : [],
    updatedAt: src.updatedAt,
  }
}

// IDs for user-added Freie entries are negative so they can never collide with
// a base-row id (base ids run 2…6591, positive integers). Keeps the merge
// deterministic even if the overrides doc is shared between devices.
export function nextAddedFreiId(added: FreiEntry[]): number {
  let min = -1
  for (const e of added) {
    if (typeof e.id === 'number' && e.id < min) min = e.id
  }
  return min - 1
}

// Produces a Katalog object the UI can use as-is. The merged list preserves
// insertion order: all base entries first (edits applied in place, hidden
// entries removed), then user-added rows at the end.
export function mergeKatalog(base: Katalog, overrides: KatalogOverrides): Katalog {
  const hiddenKgk = new Set(overrides.kgkHidden)
  const hiddenFrei = new Set(overrides.freiHidden)

  const kgk: KgkEntry[] = []
  for (const e of base.kgk) {
    if (hiddenKgk.has(e.code)) continue
    const patch = overrides.kgkUpdates[e.code]
    kgk.push(patch ? { ...e, ...patch } : e)
  }
  // Appending user-added entries. Still pass them through hidden-check in
  // case a later override accidentally hid them.
  for (const e of overrides.kgkAdded) {
    if (!hiddenKgk.has(e.code)) kgk.push(e)
  }

  const frei: FreiEntry[] = []
  for (const e of base.frei) {
    if (hiddenFrei.has(e.id)) continue
    const patch = overrides.freiUpdates[String(e.id)]
    frei.push(patch ? { ...e, ...patch } : e)
  }
  for (const e of overrides.freiAdded) {
    if (!hiddenFrei.has(e.id)) frei.push(e)
  }

  const meta = {
    ...base.meta,
    kgkCount: kgk.length,
    freiCount: frei.length,
    kgkMitPreis: kgk.filter((e) => e.epVon !== null).length,
    freiMitPreis: frei.filter((e) => e.betrag !== null).length,
  }

  return {
    meta,
    kgk,
    frei,
    kgkByCode: new Map(kgk.map((e) => [e.code, e])),
  }
}

export type KgkCodeCheck =
  | { ok: true }
  | { ok: false; reason: string }

export function validateNewKgkCode(
  code: string,
  base: Katalog,
  overrides: KatalogOverrides,
): KgkCodeCheck {
  if (!/^[1-8]\d{5}[0-9A-Z]$/.test(code)) {
    return { ok: false, reason: 'Code muss 7-stellig sein, erstes Zeichen 1–8' }
  }
  if (base.kgkByCode.has(code)) {
    return { ok: false, reason: 'Code existiert bereits im Katalog' }
  }
  if (overrides.kgkAdded.some((e) => e.code === code)) {
    return { ok: false, reason: 'Code existiert bereits unter den Ergänzungen' }
  }
  return { ok: true }
}
