import * as XLSX from 'xlsx'
import {
  emptyNEntry,
  type NEntry,
  type NStatus,
  type NoteColumn,
  type PlBranchStatus,
  type Rechnungsplan,
  type RechnungsplanRow,
} from '@/types'

const MONTHS: Record<string, number> = {
  Januar: 1,
  Februar: 2,
  März: 3,
  April: 4,
  Mai: 5,
  Juni: 6,
  Juli: 7,
  August: 8,
  September: 9,
  Oktober: 10,
  November: 11,
  Dezember: 12,
}

export type ImportSheet = {
  sheetName: string
  month: number | null
  plan: Rechnungsplan | null
  rowCount: number
  skippedRows: number
  error?: string
}

export type ImportResult = {
  year: number
  sheets: ImportSheet[]
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'note'
}

function parseNum(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && v.trim() !== '-') {
    const n = Number(v.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseNEntry(v: unknown): NEntry {
  if (v == null || v === '') return emptyNEntry()
  if (v instanceof Date) return { status: 'rgGestellt', datum: isoDate(v) }
  const s = String(v).trim()
  if (s === '' || s === '-' || s.toLowerCase() === 'nicht relevant' || s.toLowerCase() === 'nichtrelevant') {
    return { status: 'nichtRelevant' }
  }
  // ISO date or German date
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return { status: 'rgGestellt', datum: s.slice(0, 10) }
  const deMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (deMatch) {
    const [, d, m, y] = deMatch
    return {
      status: 'rgGestellt',
      datum: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
    }
  }
  const low = s.toLowerCase()
  if (low === 'aktuell') return { status: 'aktuell' }
  if (low.includes('gestellt')) return { status: 'rgGestellt' }
  return { status: 'nichtRelevant' }
}

function parseDeStatus(v: unknown): NStatus {
  const e = parseNEntry(v)
  return e.status
}

function parsePlBranch(v: unknown): PlBranchStatus {
  if (v == null) return 'nein'
  const s = String(v).trim().toLowerCase()
  if (s === 'ja') return 'ja'
  if (s === 'nein' || s === '-' || s === '') return 'nein'
  if (s === 'neu') return 'neu'
  return 'nein'
}

function findIndex(header: unknown[], pattern: RegExp | string, from = 0): number {
  for (let i = from; i < header.length; i++) {
    const h = String(header[i] ?? '').trim()
    if (typeof pattern === 'string' ? h === pattern : pattern.test(h)) return i
  }
  return -1
}

function findIndices(header: unknown[], pattern: RegExp): number[] {
  const out: number[] = []
  for (let i = 0; i < header.length; i++) {
    const h = String(header[i] ?? '').trim()
    if (pattern.test(h)) out.push(i)
  }
  return out
}

export function parseWorkbook(buf: ArrayBuffer, year: number): ImportResult {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheets: ImportSheet[] = []
  for (const sheetName of wb.SheetNames) {
    const month = MONTHS[sheetName.trim()] ?? null
    if (!month) {
      sheets.push({ sheetName, month: null, plan: null, rowCount: 0, skippedRows: 0, error: 'Monat nicht erkannt' })
      continue
    }
    try {
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
        header: 1,
        raw: false,
        defval: null,
        dateNF: 'yyyy-mm-dd',
      }) as unknown[][]
      if (aoa.length === 0) {
        sheets.push({ sheetName, month, plan: null, rowCount: 0, skippedRows: 0, error: 'leer' })
        continue
      }
      const header = aoa[0]
      const iPolen = findIndex(header, 'Polen')
      const iDe = findIndex(header, 'Deutschland')
      const iProjNr = findIndex(header, 'Proj. Nr.')
      const iProjekt = findIndex(header, 'Projekte')
      const iPl = findIndex(header, 'PL')
      const iHv = findIndex(header, 'HV')
      const nachtragIdx: number[] = []
      for (let n = 1; n <= 20; n++) {
        const i = findIndex(header, `N${String(n).padStart(2, '0')}`)
        if (i !== -1) nachtragIdx.push(i)
        else break
      }
      const iZeithonorar = findIndex(header, 'Zeithonorar')
      const noteCols: { id: string; label: string; idx: number }[] = []
      header.forEach((h, i) => {
        const s = String(h ?? '').trim()
        if (/^Bemerkung|^Fragen/i.test(s)) {
          noteCols.push({ id: slugify(s), label: s, idx: i })
        }
      })
      // Rg columns — handle both the legacy "Rechnungssumme DE" / "Rechnungssumme POL" /
      // "Nachträge für erbrachte Leistung" set and the newer "Rg. Gesamt / Rg. DE /
      // Rg. PL / Rg. PL (duplicate)" set from October.
      const iGesamt = findIndex(header, /^Rg\.?\s*Gesamt$/i)
      const iRgDe = findIndex(header, /^Rechnungssumme DE$|^Rg\.?\s*DE$/i)
      const rgPlIndices = findIndices(header, /^Rechnungssumme POL$|^Rg\.?\s*PL$/i)
      const iRgPl = rgPlIndices[0] ?? -1
      // Second "Rg. PL" column is treated as Rg. extern — matches the October
      // duplicate header the user wants kept.
      const iExtern = findIndex(header, /^Nachträge für erbrachte Leistung$/i)
      const iExternFallback = iExtern !== -1 ? iExtern : (rgPlIndices[1] ?? -1)

      const rows: RechnungsplanRow[] = []
      let skipped = 0
      for (let r = 1; r < aoa.length; r++) {
        const row = aoa[r]
        if (!row) continue
        const projNr = iProjNr !== -1 ? (row[iProjNr] ?? '') : ''
        const projekt = iProjekt !== -1 ? (row[iProjekt] ?? '') : ''
        const projNrStr = String(projNr ?? '').trim()
        const projektStr = String(projekt ?? '').trim()
        if (!projNrStr && !projektStr) {
          // Summary row or blank
          skipped++
          continue
        }
        const nachtraege: NEntry[] = nachtragIdx.map((i) => parseNEntry(row[i]))
        const hv = iHv !== -1 ? parseNEntry(row[iHv]) : emptyNEntry()
        const notes: Record<string, string> = {}
        for (const nc of noteCols) {
          const v = row[nc.idx]
          if (v != null && String(v).trim() !== '') notes[nc.id] = String(v)
        }
        rows.push({
          id: newId(),
          projNr: projNrStr,
          projektname: projektStr,
          pl: iPl !== -1 ? String(row[iPl] ?? '').trim() : '',
          deStatus: iDe !== -1 ? parseDeStatus(row[iDe]) : 'aktuell',
          plBranch: iPolen !== -1 ? parsePlBranch(row[iPolen]) : 'nein',
          hv,
          nachtraege,
          zeithonorar: iZeithonorar !== -1 ? parseNEntry(row[iZeithonorar]) : undefined,
          rgGesamt: iGesamt !== -1 ? parseNum(row[iGesamt]) : null,
          rgSummeDE: iRgDe !== -1 ? parseNum(row[iRgDe]) : null,
          rgSummePL: iRgPl !== -1 ? parseNum(row[iRgPl]) : null,
          nachtragErbracht: iExternFallback !== -1 ? parseNum(row[iExternFallback]) : null,
          notes,
        })
      }

      const plan: Rechnungsplan = {
        year,
        month,
        nachtragCount: nachtragIdx.length,
        showZeithonorar: iZeithonorar !== -1,
        noteColumns: noteCols.map<NoteColumn>((n) => ({ id: n.id, label: n.label })),
        rows,
      }

      sheets.push({ sheetName, month, plan, rowCount: rows.length, skippedRows: skipped })
    } catch (e) {
      sheets.push({
        sheetName,
        month,
        plan: null,
        rowCount: 0,
        skippedRows: 0,
        error: (e as Error).message,
      })
    }
  }
  return { year, sheets }
}
