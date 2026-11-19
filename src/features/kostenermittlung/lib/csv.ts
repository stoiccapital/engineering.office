// CSV export helpers. German locale: semicolon separator + comma decimal, so
// opening the file in Excel's German configuration lands numbers in the right
// cells. UTF-8 BOM so Excel detects the encoding and umlauts render.

import { HAUPTGRUPPEN } from './kgk'
import { byHauptgruppe, positionKosten, totalNetto } from './rollup'
import type { Kostenermittlung, Projektkopf } from '../types'

const BOM = '\uFEFF'
const SEP = ';'

const fmt2 = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  return v.toFixed(2).replace('.', ',')
}

const fmtPct1 = (v: number): string =>
  (v * 100).toFixed(1).replace('.', ',') + '%'

function escapeCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(SEP) || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCell).join(SEP)
}

function kopfLines(kopf: Projektkopf): string[] {
  const lines: string[] = []
  const pairs: [string, string][] = [
    ['Projekt', kopf.projekt],
    ['Projektnummer', kopf.projektnummer],
    ['Auftraggeber', kopf.auftraggeber],
    ['Ermittlungsart', kopf.ermittlungsart],
    ['Bearbeitet von', kopf.bearbeitetVon],
    ['Datum', kopf.datum],
    ['Projektpreisstand', kopf.projektpreisstand],
    [
      'USt-Satz',
      kopf.umsatzsteuer !== null ? fmtPct1(kopf.umsatzsteuer) : '',
    ],
  ]
  for (const [k, v] of pairs) if (v) lines.push(toRow([k, v]))
  return lines
}

function download(filename: string, content: string): void {
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function filename(kopf: Projektkopf, suffix: string, ext: string): string {
  const parts = [
    'Kostenermittlung',
    kopf.projektnummer || kopf.projekt || '',
    suffix,
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean)
  return `${parts.join('_').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ')}.${ext}`
}

export function exportPositionenCsv(doc: Kostenermittlung): void {
  const lines: string[] = []
  // Projektkopf as a leading block, then a blank row, then the positions table.
  lines.push(...kopfLines(doc.kopf))
  if (lines.length) lines.push('')
  lines.push(
    toRow([
      'Hauptgruppe',
      'KGK',
      'Text',
      'Anmerkung',
      'Menge',
      'Einheit',
      'Einheitspreis',
      'Kosten',
      'Erläuterung',
    ]),
  )
  const sorted = HAUPTGRUPPEN.flatMap((h) =>
    doc.positionen.filter((p) => p.hauptgruppe === h.nummer).map((p) => ({ p, h })),
  )
  for (const { p, h } of sorted) {
    lines.push(
      toRow([
        `${h.code} ${h.name}`,
        p.kgk ?? '',
        p.text,
        p.anmerkung ?? '',
        fmt2(p.menge),
        p.einheit,
        fmt2(p.einheitspreis),
        fmt2(positionKosten(p)),
        p.erlaeuterung ?? '',
      ]),
    )
  }
  // Grand total + optional USt / brutto.
  const netto = totalNetto(doc)
  lines.push('')
  lines.push(toRow(['', '', '', '', '', '', 'Netto gesamt', fmt2(netto), '']))
  if (doc.kopf.umsatzsteuer !== null) {
    const ust = netto * doc.kopf.umsatzsteuer
    lines.push(
      toRow([
        '',
        '',
        '',
        '',
        '',
        '',
        `USt ${fmtPct1(doc.kopf.umsatzsteuer)}`,
        fmt2(ust),
        '',
      ]),
    )
    lines.push(toRow(['', '', '', '', '', '', 'Brutto', fmt2(netto + ust), '']))
  }
  download(filename(doc.kopf, 'Positionen', 'csv'), lines.join('\r\n'))
}

export function exportUebersichtCsv(doc: Kostenermittlung): void {
  const lines: string[] = []
  lines.push(...kopfLines(doc.kopf))
  if (lines.length) lines.push('')
  lines.push(toRow(['Hauptgruppen']))
  lines.push(toRow(['KGK-Code', 'Hauptgruppe', 'Kosten netto', 'Anteil', 'Positionen']))
  const hg = byHauptgruppe(doc)
  for (const r of hg) {
    lines.push(
      toRow([
        r.code,
        r.name,
        fmt2(r.kosten),
        r.kosten ? fmtPct1(r.anteil) : '',
        r.count || '',
      ]),
    )
  }
  const netto = totalNetto(doc)
  lines.push(toRow(['', 'Summe Hauptgruppen', fmt2(netto), '', '']))
  download(filename(doc.kopf, 'Uebersicht', 'csv'), lines.join('\r\n'))
}
