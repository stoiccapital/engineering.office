// Shared helpers for the Kostenermittlung PDF exports (Positionen + Übersicht).

import type { jsPDF } from 'jspdf'
import type { Kostenermittlung, Projektkopf } from '../types'

export const fmtEUR2 = (v: number): string =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

export const fmtNum2 = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

export const fmtPct1 = (v: number): string =>
  new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(v)

export const fmtDate = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function pdfFilename(k: Projektkopf, suffix: string): string {
  const parts = [
    'Kostenermittlung',
    k.projektnummer || k.projekt || '',
    suffix,
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean)
  // Replace characters that aren't safe in a file name across OSes.
  const name = parts.join('_').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ')
  return `${name}.pdf`
}

// Header rendered on every page. Returns the bottom-Y after drawing so the
// caller can position the first table beneath it.
export function drawPageHeader(
  doc: jsPDF,
  kopf: Projektkopf,
  opts: { title: string; logoDataUrl?: string | null },
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  const topY = 32
  let y = topY

  // Logo block (if present) in the top-right corner.
  if (opts.logoDataUrl) {
    try {
      // Fit inside a 90 × 32 pt box, preserving aspect ratio.
      const maxW = 90
      const maxH = 32
      doc.addImage(
        opts.logoDataUrl,
        'PNG',
        pageWidth - margin - maxW,
        topY - 4,
        maxW,
        maxH,
        undefined,
        'FAST',
      )
    } catch {
      // Logo format jsPDF can't parse (e.g. SVG). Skip silently — the rest
      // of the export is still useful.
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(20)
  doc.text(opts.title, margin, y + 10)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  const metaLines: string[] = []
  if (kopf.projekt) metaLines.push(`Projekt: ${kopf.projekt}`)
  if (kopf.projektnummer) metaLines.push(`Nr. ${kopf.projektnummer}`)
  if (kopf.auftraggeber) metaLines.push(`AG: ${kopf.auftraggeber}`)
  if (kopf.ermittlungsart) metaLines.push(kopf.ermittlungsart)
  if (kopf.projektpreisstand) metaLines.push(`Preisstand ${kopf.projektpreisstand}`)
  if (kopf.bearbeitetVon) metaLines.push(`Bearbeitet: ${kopf.bearbeitetVon}`)
  if (kopf.datum) metaLines.push(fmtDate(kopf.datum))
  const meta = metaLines.join('  ·  ')
  const wrapped = doc.splitTextToSize(meta, pageWidth - 2 * margin - 100)
  doc.text(wrapped as string[], margin, y + 10)
  y += 10 + (Array.isArray(wrapped) ? wrapped.length : 1) * 11

  doc.setDrawColor(210)
  doc.setLineWidth(0.5)
  doc.line(margin, y + 4, pageWidth - margin, y + 4)
  return y + 12
}

// Footer with page number — called from autoTable's didDrawPage hook alongside
// the header. Keep it cheap, no dynamic layout.
export function drawPageFooter(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(140)
  const page = doc.getNumberOfPages()
  const generated = new Date().toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  doc.text(`Erstellt ${generated}`, margin, pageHeight - 18)
  doc.text(`Seite ${page}`, pageWidth - margin, pageHeight - 18, { align: 'right' })
}

export function hasMeaningfulKopf(doc: Kostenermittlung): boolean {
  const k = doc.kopf
  return Boolean(k.projekt || k.projektnummer || k.auftraggeber)
}
