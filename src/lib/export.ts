/**
 * Shared Excel / CSV export. Any view that holds tabular data uses this;
 * no hand-rolled download blobs. See docs/principles.md §1 (one primitive
 * per job).
 *
 * Usage:
 *   exportXlsx({
 *     filename: `forecast-${year}-${quarter}`,
 *     sheets: [{ name: 'Forecast', rows: [...] }],
 *   })
 *
 * Column order follows the first row's key order. Numbers go in as numbers
 * (not strings) so Excel keeps them right-aligned and sortable.
 */
import * as XLSX from 'xlsx'

export type ExportRow = Record<string, string | number | null | undefined>

export interface ExportSheet {
  name: string
  rows: ExportRow[]
  /** Optional: column widths in characters. Keys match row keys. */
  columnWidths?: Record<string, number>
  /** Optional: force this column order instead of inferring from the first row. */
  columnOrder?: string[]
}

function toSheet(sheet: ExportSheet): XLSX.WorkSheet {
  const header = sheet.columnOrder ?? Object.keys(sheet.rows[0] ?? {})
  const ws = XLSX.utils.json_to_sheet(sheet.rows, { header })
  if (sheet.columnWidths) {
    ws['!cols'] = header.map((h) => ({ wch: sheet.columnWidths![h] ?? 14 }))
  }
  return ws
}

export function exportXlsx({
  filename,
  sheets,
}: {
  /** Without extension — `.xlsx` appended. */
  filename: string
  sheets: ExportSheet[]
}): void {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, toSheet(s), s.name.slice(0, 31))
  }
  // Excel sheet names cap at 31 chars; truncate defensively.
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/** CSV fallback (single sheet, no formatting). Useful when the consumer pipes to a non-Excel tool. */
export function exportCsv({
  filename,
  rows,
  columnOrder,
}: {
  filename: string
  rows: ExportRow[]
  columnOrder?: string[]
}): void {
  const header = columnOrder ?? Object.keys(rows[0] ?? {})
  const ws = XLSX.utils.json_to_sheet(rows, { header })
  const csv = XLSX.utils.sheet_to_csv(ws)
  // Prepend BOM so Excel on Windows detects UTF-8 (otherwise ü/ä/ö break).
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
