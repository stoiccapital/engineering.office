import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  byEbene2,
  byHauptgruppe,
  openPositionCount,
  status,
  totalNetto,
} from './rollup'
import {
  drawPageFooter,
  drawPageHeader,
  fmtEUR2,
  fmtPct1,
  pdfFilename,
} from './pdf'
import type { Kostenermittlung } from '../types'

export function exportUebersichtPdf(
  doc: Kostenermittlung,
  opts: { logoDataUrl?: string | null } = {},
): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const margin = 40
  const pageWidth = pdf.internal.pageSize.getWidth()
  const title = 'Kostenermittlung · Übersicht'

  let y = drawPageHeader(pdf, doc.kopf, { title, logoDataUrl: opts.logoDataUrl })
  drawPageFooter(pdf)

  // --- KPI strip -----------------------------------------------------------
  const netto = totalNetto(doc)
  const positionen = doc.positionen.length
  const offen = openPositionCount(doc)
  const ustSatz = doc.kopf.umsatzsteuer
  const ust = ustSatz !== null ? netto * ustSatz : null
  const brutto = ust !== null ? netto + ust : null

  const kpis: { label: string; value: string; sub?: string }[] = [
    { label: 'Kosten netto', value: `${fmtEUR2(netto)} €` },
    {
      label: 'Positionen',
      value: String(positionen),
      sub: offen > 0 ? `${offen} offen` : undefined,
    },
    {
      label: `USt.${ustSatz !== null ? ' ' + fmtPct1(ustSatz) : ''}`,
      value: ust !== null ? `${fmtEUR2(ust)} €` : '—',
    },
    {
      label: 'Kosten brutto',
      value: brutto !== null ? `${fmtEUR2(brutto)} €` : '—',
    },
  ]

  const kpiW = (pageWidth - 2 * margin - 3 * 8) / 4
  const kpiH = 46
  kpis.forEach((kpi, i) => {
    const x = margin + i * (kpiW + 8)
    pdf.setDrawColor(220)
    pdf.setLineWidth(0.5)
    pdf.roundedRect(x, y, kpiW, kpiH, 4, 4, 'S')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(120)
    pdf.text(kpi.label, x + 8, y + 14)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.setTextColor(20)
    pdf.text(kpi.value, x + 8, y + 32)
    if (kpi.sub) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(140)
      pdf.text(kpi.sub, x + 8, y + 42)
    }
  })
  y += kpiH + 8

  // --- Status badge --------------------------------------------------------
  const st = status(doc)
  const standLabel =
    st === 'vollständig'
      ? 'Alle Ansätze berechnet'
      : st === 'leer'
        ? 'Noch keine Kostenansätze'
        : `Unvollständig · ${offen} Position${offen === 1 ? '' : 'en'} offen`
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(st === 'vollständig' ? 20 : st === 'leer' ? 120 : 180)
  pdf.text(`Bearbeitungsstand: ${standLabel}`, margin, y + 10)
  y += 20

  // --- Hauptgruppen rollup -------------------------------------------------
  const hg = byHauptgruppe(doc)
  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin, top: 80, bottom: 40 },
    head: [['KGK-Code', 'Hauptgruppe', 'Kosten netto', 'Anteil', 'Pos.']],
    body: [
      ...hg.map((r) => [
        r.code,
        r.name,
        r.kosten ? `${fmtEUR2(r.kosten)} €` : '',
        r.kosten ? fmtPct1(r.anteil) : '',
        r.count || '',
      ]),
      ['', 'Summe Hauptgruppen', `${fmtEUR2(netto)} €`, '', ''],
    ],
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 4,
      lineColor: [220, 220, 220],
      lineWidth: 0.4,
      textColor: 40,
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: 80,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 70, font: 'courier' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 90, halign: 'right' },
      3: { cellWidth: 55, halign: 'right' },
      4: { cellWidth: 40, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === hg.length) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [250, 250, 250]
      }
    },
    didDrawPage: () => {
      drawPageHeader(pdf, doc.kopf, { title, logoDataUrl: opts.logoDataUrl })
      drawPageFooter(pdf)
    },
  })
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16

  // --- Ebene-2 rollup ------------------------------------------------------
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(20)
  if (y > pdf.internal.pageSize.getHeight() - 80) {
    pdf.addPage()
    y = drawPageHeader(pdf, doc.kopf, { title, logoDataUrl: opts.logoDataUrl })
    drawPageFooter(pdf)
  }
  pdf.text('Zweite Kostengliederungsebene', margin, y + 8)
  y += 14

  const e2 = byEbene2(doc)
  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin, top: 80, bottom: 40 },
    head: [['KGK-Code', 'Kostengruppe / direkte Ansätze', 'Kosten netto', 'Pos.']],
    body: [
      ...e2.map((r) => [
        r.code,
        r.name,
        r.kosten ? `${fmtEUR2(r.kosten)} €` : '',
        r.count || '',
      ]),
      ['', 'Summe Ebene 2 und direkte Ansätze', `${fmtEUR2(netto)} €`, ''],
    ],
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 3,
      lineColor: [220, 220, 220],
      lineWidth: 0.4,
      textColor: 40,
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: 80,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 70, font: 'courier' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 90, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
    },
    didParseCell: (data) => {
      const row = e2[data.row.index]
      if (data.row.index === e2.length) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [250, 250, 250]
      } else if (row?.sammler) {
        data.cell.styles.fillColor = [248, 248, 248]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: () => {
      drawPageHeader(pdf, doc.kopf, { title, logoDataUrl: opts.logoDataUrl })
      drawPageFooter(pdf)
    },
  })

  pdf.save(pdfFilename(doc.kopf, 'Uebersicht'))
}
