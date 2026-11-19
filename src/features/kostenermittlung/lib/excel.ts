// Excel export via SheetJS (xlsx, already a project dep). One workbook per
// view with separate sheets for Projektkopf, data, and rollups.

import * as XLSX from 'xlsx'
import { HAUPTGRUPPEN } from './kgk'
import { byEbene2, byHauptgruppe, positionKosten, totalNetto } from './rollup'
import type { Kostenermittlung, Projektkopf } from '../types'

function kopfRows(kopf: Projektkopf): (string | number)[][] {
  const rows: (string | number)[][] = []
  const pairs: [string, string | number][] = [
    ['Projekt', kopf.projekt],
    ['Projektnummer', kopf.projektnummer],
    ['Auftraggeber', kopf.auftraggeber],
    ['Ermittlungsart', kopf.ermittlungsart],
    ['Bearbeitet von', kopf.bearbeitetVon],
    ['Datum', kopf.datum],
    ['Projektpreisstand', kopf.projektpreisstand],
    ['USt-Satz', kopf.umsatzsteuer ?? ''],
  ]
  for (const [k, v] of pairs) if (v !== '' && v !== null) rows.push([k, v])
  return rows
}

function filename(kopf: Projektkopf, suffix: string): string {
  const parts = [
    'Kostenermittlung',
    kopf.projektnummer || kopf.projekt || '',
    suffix,
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean)
  return `${parts.join('_').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ')}.xlsx`
}

function autoFitCols(
  sheet: XLSX.WorkSheet,
  rows: (string | number | null | undefined)[][],
): void {
  if (rows.length === 0) return
  const widths: number[] = []
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = cell === null || cell === undefined ? 0 : String(cell).length
      widths[i] = Math.max(widths[i] ?? 0, len)
    })
  }
  sheet['!cols'] = widths.map((w) => ({ wch: Math.min(Math.max(w + 2, 10), 60) }))
}

export function exportPositionenXlsx(doc: Kostenermittlung): void {
  const wb = XLSX.utils.book_new()

  // Projektkopf sheet.
  const kopf = kopfRows(doc.kopf)
  const kopfSheet = XLSX.utils.aoa_to_sheet([
    ['Projektkopf'],
    [],
    ...kopf,
  ])
  autoFitCols(kopfSheet, [['Projektkopf'], ...kopf])
  XLSX.utils.book_append_sheet(wb, kopfSheet, 'Projektkopf')

  // Flat positions sheet.
  const header = [
    'Hauptgruppe-Code',
    'Hauptgruppe',
    'KGK',
    'Text',
    'Anmerkung',
    'Menge',
    'Einheit',
    'Einheitspreis',
    'Kosten',
    'Erläuterung',
  ]
  const rows: (string | number)[][] = [header]
  for (const h of HAUPTGRUPPEN) {
    const items = doc.positionen.filter((p) => p.hauptgruppe === h.nummer)
    for (const p of items) {
      rows.push([
        h.code,
        h.name,
        p.kgk ?? '',
        p.text,
        p.anmerkung ?? '',
        p.menge,
        p.einheit,
        p.einheitspreis,
        positionKosten(p),
        p.erlaeuterung ?? '',
      ])
    }
  }
  const netto = totalNetto(doc)
  rows.push([])
  rows.push(['', '', '', '', '', '', '', 'Netto gesamt', netto, ''])
  if (doc.kopf.umsatzsteuer !== null) {
    const ust = netto * doc.kopf.umsatzsteuer
    rows.push(['', '', '', '', '', '', '', `USt ${doc.kopf.umsatzsteuer}`, ust, ''])
    rows.push(['', '', '', '', '', '', '', 'Brutto', netto + ust, ''])
  }
  const posSheet = XLSX.utils.aoa_to_sheet(rows)
  autoFitCols(posSheet, rows)
  XLSX.utils.book_append_sheet(wb, posSheet, 'Positionen')

  XLSX.writeFile(wb, filename(doc.kopf, 'Positionen'))
}

export function exportUebersichtXlsx(doc: Kostenermittlung): void {
  const wb = XLSX.utils.book_new()

  // Projektkopf + KPIs.
  const netto = totalNetto(doc)
  const ust = doc.kopf.umsatzsteuer !== null ? netto * doc.kopf.umsatzsteuer : null
  const brutto = ust !== null ? netto + ust : null
  const kopf = kopfRows(doc.kopf)
  const kpis: (string | number)[][] = [
    ['Kosten netto', netto],
    ['Positionen', doc.positionen.length],
    ['USt', ust ?? ''],
    ['Kosten brutto', brutto ?? ''],
  ]
  const kopfSheet = XLSX.utils.aoa_to_sheet([
    ['Projektkopf'],
    [],
    ...kopf,
    [],
    ['KPI'],
    [],
    ...kpis,
  ])
  autoFitCols(kopfSheet, [['Projektkopf'], ...kopf, ...kpis])
  XLSX.utils.book_append_sheet(wb, kopfSheet, 'Projekt')

  // Hauptgruppen rollup.
  const hg = byHauptgruppe(doc)
  const hgRows: (string | number)[][] = [
    ['KGK-Code', 'Hauptgruppe', 'Kosten netto', 'Anteil', 'Positionen'],
    ...hg.map((r) => [r.code, r.name, r.kosten, r.kosten ? r.anteil : '', r.count]),
    ['', 'Summe Hauptgruppen', netto, '', ''],
  ]
  const hgSheet = XLSX.utils.aoa_to_sheet(hgRows)
  // Format Anteil as percent.
  const pctCol = 3
  for (let r = 1; r <= hg.length; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: pctCol })
    if (hgSheet[addr]) hgSheet[addr].z = '0.0%'
  }
  autoFitCols(hgSheet, hgRows)
  XLSX.utils.book_append_sheet(wb, hgSheet, 'Hauptgruppen')

  // Ebene-2 rollup.
  const e2 = byEbene2(doc)
  const e2Rows: (string | number)[][] = [
    ['KGK-Code', 'Kostengruppe', 'Hauptgruppe', 'Sammler', 'Kosten netto', 'Positionen'],
    ...e2.map((r) => [
      r.code,
      r.name,
      r.hauptgruppe,
      r.sammler ? 'ja' : '',
      r.kosten,
      r.count,
    ]),
    ['', 'Summe Ebene 2 und direkte Ansätze', '', '', netto, ''],
  ]
  const e2Sheet = XLSX.utils.aoa_to_sheet(e2Rows)
  autoFitCols(e2Sheet, e2Rows)
  XLSX.utils.book_append_sheet(wb, e2Sheet, 'Ebene 2')

  XLSX.writeFile(wb, filename(doc.kopf, 'Uebersicht'))
}
