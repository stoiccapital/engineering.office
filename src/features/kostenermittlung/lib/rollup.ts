import { EBENE2, HAUPTGRUPPEN, findEbene2, validateKgk } from './kgk'
import type { Kostenermittlung, Position } from '../types'

export function positionKosten(p: Position): number {
  return (p.menge ?? 0) * (p.einheitspreis ?? 0)
}

export function totalNetto(doc: Kostenermittlung): number {
  return doc.positionen.reduce((a, p) => a + positionKosten(p), 0)
}

export type Status = 'leer' | 'unvollständig' | 'vollständig'

export function openPositionCount(doc: Kostenermittlung): number {
  return doc.positionen.filter(
    (p) =>
      !validateKgk(p.kgk, p.hauptgruppe).ok ||
      !p.text ||
      !p.einheit ||
      p.menge === 0 ||
      p.einheitspreis === 0,
  ).length
}

export function status(doc: Kostenermittlung): Status {
  if (doc.positionen.length === 0) return 'leer'
  return openPositionCount(doc) > 0 ? 'unvollständig' : 'vollständig'
}

export type HauptgruppeRow = {
  code: string
  nummer: number
  name: string
  kosten: number
  anteil: number // 0..1
  count: number
}

export function byHauptgruppe(doc: Kostenermittlung): HauptgruppeRow[] {
  const total = totalNetto(doc)
  return HAUPTGRUPPEN.map((h) => {
    const sub = doc.positionen.filter((p) => p.hauptgruppe === h.nummer)
    const kosten = sub.reduce((a, p) => a + positionKosten(p), 0)
    return {
      code: h.code,
      nummer: h.nummer,
      name: h.name,
      kosten,
      anteil: total > 0 ? kosten / total : 0,
      count: sub.length,
    }
  })
}

export type Ebene2Row = {
  code: string
  name: string
  hauptgruppe: number
  sammler: boolean
  kosten: number
  count: number
}

// Replicates the Excel "Kosten nach zweiter Kostengliederungsebene" table:
// positions with a code known in the Ebene-2 catalog roll up to that row; any
// position whose code only matches a Hauptgruppen-level (xxxx000) or is
// invalid is aggregated into that Hauptgruppen's "— direkt / Sammler" row.
export function byEbene2(doc: Kostenermittlung): Ebene2Row[] {
  const rows: Ebene2Row[] = EBENE2.map((e) => ({
    code: e.code,
    name: e.name,
    hauptgruppe: e.hauptgruppe,
    sammler: e.sammler,
    kosten: 0,
    count: 0,
  }))
  const idx = new Map<string, number>()
  rows.forEach((r, i) => idx.set(`${r.hauptgruppe}:${r.code}`, i))
  // "Sammler" row per Hauptgruppe is keyed by (hauptgruppe, hauptgruppeCode).
  const sammlerIdx = new Map<number, number>()
  rows.forEach((r, i) => {
    if (r.sammler) sammlerIdx.set(r.hauptgruppe, i)
  })

  for (const p of doc.positionen) {
    const match = findEbene2(p.kgk)
    const kosten = positionKosten(p)
    if (match && match.hauptgruppe === p.hauptgruppe && !match.sammler) {
      const i = idx.get(`${p.hauptgruppe}:${match.code}`)
      if (i !== undefined) {
        rows[i].kosten += kosten
        rows[i].count += 1
        continue
      }
    }
    const i = sammlerIdx.get(p.hauptgruppe)
    if (i !== undefined) {
      rows[i].kosten += kosten
      rows[i].count += 1
    }
  }
  return rows
}
