#!/usr/bin/env node
// Smoke test for the Kostenermittlung module.
// Verifies the extracted catalogs match expectations and that the pure
// domain logic (KGK validation, search, rollup) behaves correctly.

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, '..', 'src', 'features', 'kostenermittlung', 'data')

let pass = 0
let fail = 0
function assert(cond, label) {
  if (cond) {
    pass++
    console.log(`  ok  ${label}`)
  } else {
    fail++
    console.log(`  FAIL ${label}`)
  }
}

function section(name) {
  console.log(`\n== ${name} ==`)
}

const kgk = JSON.parse(fs.readFileSync(path.join(DATA, 'katalog_kgk.json'), 'utf8'))
const frei = JSON.parse(fs.readFileSync(path.join(DATA, 'katalog_frei.json'), 'utf8'))
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'katalogMeta.json'), 'utf8'))
const seed = JSON.parse(fs.readFileSync(path.join(DATA, 'seed.json'), 'utf8'))

// ---------------------------------------------------------------- data shape
section('data shape')
assert(kgk.length === 3753, `KGK has ${kgk.length} entries (expected 3753)`)
assert(frei.length === 6590, `Freie has ${frei.length} entries (expected 6590)`)
assert(meta.quartal === 'Q3/2026', `meta.quartal = ${meta.quartal}`)
assert(meta.faktor === 141.7, `meta.faktor = ${meta.faktor}`)
assert(meta.kgkMitPreis === 876, `meta.kgkMitPreis = ${meta.kgkMitPreis}`)
assert(meta.freiMitPreis === 6548, `meta.freiMitPreis = ${meta.freiMitPreis}`)

// All KGK codes are 7 chars (digits, with optional trailing A–Z at Ebene 6).
const bad = kgk.filter((e) => !/^[1-8]\d{5}[0-9A-Z]$/.test(e.code))
assert(bad.length === 0, `all KGK codes well-formed (${bad.length} bad)`)
// Known: exactly 25 letter-suffix variants.
const variants = kgk.filter((e) => /^\d{6}[A-Z]$/.test(e.code))
assert(variants.length === 25, `25 Ebene-6 letter variants (got ${variants.length})`)

// Ebene distribution
const byEbene = {}
for (const e of kgk) byEbene[e.ebene] = (byEbene[e.ebene] || 0) + 1
assert(byEbene[1] === 8, `8 Ebene-1 roots (${byEbene[1]})`)

// Parent references: every parent must exist (except Ebene-1 roots)
const codes = new Set(kgk.map((e) => e.code))
const orphans = kgk.filter((e) => e.parent !== null && !codes.has(e.parent))
assert(orphans.length === 0, `all parent refs resolve (${orphans.length} orphans)`)

// Spot-check known entries from the Excel
const grundstueck = kgk.find((e) => e.code === '1011000')
assert(grundstueck?.bezeichnung === 'Land- und forstwirtschaftliche Flächen', 'spot: 1011000')
assert(
  grundstueck?.epVon === 17.8 && grundstueck?.epBis === 40.57,
  'spot: 1011000 EP range 17.8 – 40.57',
)

// Hauptgruppen codes all present at Ebene 1
const expected = ['1000000', '2000000', '3000000', '4000000', '5000000', '6000000', '7000000', '8000000']
const haupt = kgk.filter((e) => e.ebene === 1).map((e) => e.code).sort()
assert(JSON.stringify(haupt) === JSON.stringify(expected), `8 Hauptgruppen match`)

// All priced KGK rows have a unit
const pricedNoUnit = kgk.filter((e) => e.epVon !== null && !e.einheit)
assert(pricedNoUnit.length === 0, `priced KGK rows all have Einheit (${pricedNoUnit.length} bad)`)

// Freie DB sanity
const freiBad = frei.filter((e) => !e.bezeichnung)
assert(freiBad.length === 0, `all freie entries have Bezeichnung`)

// -------------------------------------------------------- validateKgk logic
section('validateKgk logic')
function validateKgk(code, hauptgruppe) {
  if (!code) return { ok: false, reason: 'missing' }
  if (!/^[1-8]\d{5}[0-9A-Z]$/.test(code)) return { ok: false, reason: 'format' }
  if (Number(code[0]) !== hauptgruppe) return { ok: false, reason: 'hauptgruppe' }
  return { ok: true }
}
assert(validateKgk('3330000', 3).ok, 'valid Massivbrücken code under HG 3')
assert(validateKgk('712117A', 7).ok, 'Ebene-6 letter variant 712117A accepted')
assert(!validateKgk('3330000', 4).ok, 'wrong hauptgruppe is rejected')
assert(!validateKgk('abc', 3).ok, 'non-numeric rejected')
assert(!validateKgk(null, 3).ok, 'null rejected')
assert(!validateKgk('33300', 3).ok, 'too short rejected')

// --------------------------------------------- defaultPrice midpoint logic
section('defaultPrice midpoint')
function defaultPrice(e) {
  if (e.epVon !== null && e.epBis !== null) return (e.epVon + e.epBis) / 2
  return e.epVon ?? e.epBis ?? 0
}
assert(Math.abs(defaultPrice(grundstueck) - (17.8 + 40.57) / 2) < 1e-9, 'midpoint 1011000')
const singlePriceEntry = kgk.find((e) => e.epVon !== null && e.epBis === null)
if (singlePriceEntry) {
  assert(
    defaultPrice(singlePriceEntry) === singlePriceEntry.epVon,
    'single-price falls back to epVon',
  )
}

// --------------------------------------------------- search helpers
section('search helpers')
function searchKgk(query, { withPriceOnly = false, hauptgruppe } = {}, limit = 300) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const out = []
  for (const e of kgk) {
    if (withPriceOnly && e.epVon === null) continue
    if (hauptgruppe !== undefined && Number(e.code[0]) !== hauptgruppe) continue
    const hay = `${e.code} ${e.bezeichnung} ${e.pfad ?? ''}`.toLowerCase()
    if (terms.every((t) => hay.includes(t))) {
      out.push(e)
      if (out.length >= limit) break
    }
  }
  return out
}
const brueckenHits = searchKgk('brücke', { hauptgruppe: 3 })
assert(brueckenHits.length > 0, `search "brücke" under HG 3: ${brueckenHits.length} hits`)
const massivHits = searchKgk('massivbrücken', { withPriceOnly: false })
assert(
  massivHits.some((e) => e.bezeichnung.toLowerCase().includes('massivbrücke')),
  'search "massivbrücken" surfaces Massivbrücken entries',
)
const codeSearch = searchKgk('3330000')
assert(codeSearch.length === 1 && codeSearch[0].code === '3330000', 'search by code 3330000')
const noHits = searchKgk('xyz-no-such-term')
assert(noHits.length === 0, 'nonsense query returns empty')

function searchFrei(query, { withPriceOnly = true } = {}, limit = 300) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const out = []
  for (const e of frei) {
    if (withPriceOnly && e.betrag === null) continue
    const hay = `${e.bezeichnung} ${e.anmerkung ?? ''}`.toLowerCase()
    if (terms.every((t) => hay.includes(t))) {
      out.push(e)
      if (out.length >= limit) break
    }
  }
  return out
}
const acker = searchFrei('acker')
assert(acker.length > 0, `search "acker" on Freie DB: ${acker.length} hits`)

// ------------------------------------------- byHauptgruppe + byEbene2 rollup
section('rollup logic')

const EBENE2_HAUPTGRUPPEN_CODES = ['1000000', '2000000', '3000000', '4000000', '5000000', '6000000', '7000000', '8000000']
function byHauptgruppeFn(doc) {
  const total = doc.positionen.reduce((a, p) => a + p.menge * p.einheitspreis, 0)
  return EBENE2_HAUPTGRUPPEN_CODES.map((code, i) => {
    const nummer = i + 1
    const sub = doc.positionen.filter((p) => p.hauptgruppe === nummer)
    const kosten = sub.reduce((a, p) => a + p.menge * p.einheitspreis, 0)
    return { code, nummer, kosten, anteil: total > 0 ? kosten / total : 0 }
  })
}

const sampleDoc = {
  kopf: seed.kopf,
  positionen: [
    { id: 'a', kgk: '3330000', hauptgruppe: 3, text: 'Brücke A', menge: 100, einheit: 'm²', einheitspreis: 2000, anmerkung: null, erlaeuterung: null },
    { id: 'b', kgk: '3330000', hauptgruppe: 3, text: 'Brücke B', menge: 50, einheit: 'm²', einheitspreis: 3000, anmerkung: null, erlaeuterung: null },
    { id: 'c', kgk: '1011000', hauptgruppe: 1, text: 'Acker', menge: 10000, einheit: 'm²', einheitspreis: 26.7, anmerkung: null, erlaeuterung: null },
    { id: 'd', kgk: null, hauptgruppe: 7, text: 'Baunebenkosten', menge: 1, einheit: 'psch', einheitspreis: 50000, anmerkung: null, erlaeuterung: null },
  ],
}

const hg = byHauptgruppeFn(sampleDoc)
assert(hg[0].kosten === 267000, `HG 1 (Grundstück) = 10000 × 26,70 = 267.000 (got ${hg[0].kosten})`)
assert(hg[2].kosten === 350000, `HG 3 (Baukonstruktionen) = 100×2000 + 50×3000 = 350.000 (got ${hg[2].kosten})`)
assert(hg[6].kosten === 50000, `HG 7 (Baunebenkosten) = 50.000 (got ${hg[6].kosten})`)
assert(hg[3].kosten === 0, `HG 4 has no positions`)
const expectedTotal = 267000 + 350000 + 50000
assert(
  Math.abs(hg[0].anteil - 267000 / expectedTotal) < 1e-9,
  `HG 1 Anteil = ${hg[0].anteil}`,
)

// ------------------------------------------------ KatalogPicker roundtrip
section('pickToPatch roundtrip')
function pickToPatch(pick) {
  if (pick.source === 'kgk') {
    const e = pick.entry
    return {
      kgk: e.code,
      text: e.bezeichnung,
      einheit: e.einheit ?? '',
      einheitspreis: defaultPrice(e),
      anmerkung: e.anmerkung ?? null,
    }
  }
  const e = pick.entry
  return {
    text: e.bezeichnung,
    einheit: e.einheit ?? '',
    einheitspreis: e.betrag ?? 0,
    anmerkung: e.anmerkung ?? null,
  }
}
const kgkPatch = pickToPatch({ source: 'kgk', entry: grundstueck })
assert(kgkPatch.kgk === '1011000', 'KGK pick writes code')
assert(kgkPatch.einheit === 'm²', 'KGK pick writes unit (m² normalized)')
assert(Math.abs(kgkPatch.einheitspreis - (17.8 + 40.57) / 2) < 1e-9, 'KGK pick writes midpoint')

// "Acker" lives in anmerkung (bezeichnung = "Land- und forstwirtschaftliche Flächen"),
// so search both fields.
const freiEntry = frei.find(
  (e) =>
    `${e.bezeichnung} ${e.anmerkung ?? ''}`.toLowerCase().includes('acker') &&
    e.betrag !== null,
)
assert(freiEntry !== undefined, 'found a Freie entry mentioning "Acker"')
const freiPatch = pickToPatch({ source: 'frei', entry: freiEntry })
assert(!('kgk' in freiPatch), 'Freie pick does NOT set KGK')
assert(freiPatch.einheitspreis === freiEntry.betrag, 'Freie pick writes Betrag')
assert(freiPatch.anmerkung === freiEntry.anmerkung, 'Freie pick carries anmerkung into row')

// ------------------------------------------------- Katalog coverage calc
section('coverage KPI')
const kgkByCode = new Map(kgk.map((e) => [e.code, e]))
const hits = sampleDoc.positionen.filter((p) => p.kgk !== null && kgkByCode.has(p.kgk)).length
assert(hits === 3, `coverage = 3 of 4 positions resolve (got ${hits})`)
assert(hits / sampleDoc.positionen.length === 0.75, 'coverage ratio = 0.75')

// ------------------------------------------------- summary
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
