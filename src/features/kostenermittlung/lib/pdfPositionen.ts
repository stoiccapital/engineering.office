import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { HAUPTGRUPPEN } from './kgk'
import { positionKosten, totalNetto } from './rollup'
import {
  drawPageFooter,
  drawPageHeader,
  fmtEUR2,
  fmtNum2,
  pdfFilename,
} from './pdf'
import type { Kostenermittlung, Position } from '../types'

export function exportPositionenPdf(
  doc: Kostenermittlung,
  opts: { logoDataUrl?: string | null } = {},
): void {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margin = 40
  const pageWidth = pdf.internal.pageSize.getWidth()

  // Reserve space at the top of every page for the header. We draw the header
  // AND footer in autoTable's didDrawPage callback so paginated tables look
  // the same on every page.
  const headerY = () =>
    drawPageHeader(pdf, doc.kopf, { title: 'Kostenermittlung · Positionen', logoDataUrl: opts.logoDataUrl })

  // Draw the first page header up-front so the first Hauptgruppe title lands
  // underneath it. autoTable's didDrawPage will repeat for every subsequent page.
  let y = headerY()

  const grouped = new Map<number, Position[]>()
  HAUPTGRUPPEN.forEach((h) => grouped.set(h.nummer, []))
  for (const p of doc.positionen) {
    const list = grouped.get(p.hauptgruppe)
    if (list) list.push(p)
  }

  for (const h of HAUPTGRUPPEN) {
    const items = grouped.get(h.nummer) ?? []
    if (items.length === 0) continue

    // Hauptgruppe heading sits above its table.
    const headingY = y + 4
    if (headingY > pdf.internal.pageSize.getHeight() - 60) {
      pdf.addPage()
      y = headerY()
    }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(20)
    pdf.text(`${h.code} · ${h.name}`, margin, y + 10)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(90)
    const sum = items.reduce((a, p) => a + positionKosten(p), 0)
    pdf.text(
      `${items.length} Pos.  ·  ${fmtEUR2(sum)} €`,
      pageWidth - margin,
      y + 10,
      { align: 'right' },
    )
    y += 16

    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin, top: 80, bottom: 40 },
      head: [[
        'KGK',
        'Text',
        'Anmerkung',
        'Menge',
        'Einheit',
        'EP',
        'Kosten',
        'Erläuterung',
      ]],
      body: items.map((p) => [
        p.kgk ?? '',
        p.text ?? '',
        p.anmerkung ?? '',
        fmtNum2(p.menge),
        p.einheit ?? '',
        fmtNum2(p.einheitspreis),
        fmtEUR2(positionKosten(p)),
        p.erlaeuterung ?? '',
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 8,
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
        0: { cellWidth: 60, font: 'courier' },
        1: { cellWidth: 140 },
        2: { cellWidth: 120 },
        3: { cellWidth: 50, halign: 'right' },
        4: { cellWidth: 40 },
        5: { cellWidth: 55, halign: 'right' },
        6: { cellWidth: 70, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 'auto' },
      },
      didDrawPage: () => {
        drawPageHeader(pdf, doc.kopf, {
          title: 'Kostenermittlung · Positionen',
          logoDataUrl: opts.logoDataUrl,
        })
        drawPageFooter(pdf)
      },
    })

    // Track Y for the next Hauptgruppe heading.
    const lastY = (
      pdf as unknown as { lastAutoTable: { finalY: number } }
    ).lastAutoTable.finalY
    y = lastY + 18
  }

  // Grand totals at the end. If we're close to the page bottom, start a new page.
  if (y > pdf.internal.pageSize.getHeight() - 90) {
    pdf.addPage()
    y = headerY()
    drawPageFooter(pdf)
  }
  const netto = totalNetto(doc)
  const ust = doc.kopf.umsatzsteuer !== null ? netto * doc.kopf.umsatzsteuer : null
  const brutto = ust !== null ? netto + ust : null

  pdf.setDrawColor(180)
  pdf.setLineWidth(0.6)
  pdf.line(pageWidth - margin - 260, y, pageWidth - margin, y)
  y += 14

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(20)
  pdf.text('Netto gesamt', pageWidth - margin - 260, y)
  pdf.text(`${fmtEUR2(netto)} €`, pageWidth - margin, y, { align: 'right' })

  if (ust !== null && brutto !== null) {
    y += 14
    pdf.setFont('helvetica', 'normal')
    pdf.text(
      `USt. ${new Intl.NumberFormat('de-DE', { style: 'percent', minimumFractionDigits: 1 }).format(doc.kopf.umsatzsteuer ?? 0)}`,
      pageWidth - margin - 260,
      y,
    )
    pdf.text(`${fmtEUR2(ust)} €`, pageWidth - margin, y, { align: 'right' })
    y += 14
    pdf.setFont('helvetica', 'bold')
    pdf.text('Brutto', pageWidth - margin - 260, y)
    pdf.text(`${fmtEUR2(brutto)} €`, pageWidth - margin, y, { align: 'right' })
  }

  pdf.save(pdfFilename(doc.kopf, 'Positionen'))
}
