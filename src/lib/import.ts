import * as XLSX from 'xlsx'
import type { ProjectRow, RiskFlag } from '@/types'

export const IMPORT_COLUMNS: Record<string, keyof ProjectRow> = {
  // snake_case
  projektleiter_de: 'projektleiterDE',
  projektleiter_pl: 'projektleiterPL',
  projektname: 'projektname',
  proj_nr: 'projNr',
  leistung: 'leistung',
  forecast_de: 'forecastDE',
  flag_de: 'flagDE',
  forecast_pl: 'forecastPL',
  flag_pl: 'flagPL',
  abgerechnet_de: 'abgerechnetDE',
  abgerechnet_pl: 'abgerechnetPL',
  leistungsstand_de: 'leistungsstandDE',
  leistungsstand_pl: 'leistungsstandPL',
}

export const IMPORT_TEMPLATE_HEADERS = [
  'projektleiter_de',
  'projektleiter_pl',
  'projektname',
  'proj_nr',
  'leistung',
  'forecast_de',
  'flag_de',
  'forecast_pl',
  'flag_pl',
  'abgerechnet_de',
  'abgerechnet_pl',
  'leistungsstand_de',
  'leistungsstand_pl',
] as const

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/[äÄ]/g, 'a')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .replace(/[ß]/g, 'ss')
    .replace(/\./g, '')
    .replace(/pln\b/g, 'pl')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const cleaned = v.trim().replace(/\s/g, '').replace(/,/g, '.')
    if (!cleaned) return null
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toFlag(v: unknown): RiskFlag {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'k' || s === 'kritisch') return 'k'
  }
  return 'w'
}

function toString(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function emptyRow(): ProjectRow {
  return {
    id: crypto.randomUUID(),
    projektleiterDE: '',
    projektleiterPL: '',
    projektname: '',
    projNr: '',
    leistung: '',
    forecastDE: null,
    flagDE: 'w',
    forecastPL: null,
    flagPL: 'w',
    abgerechnetDE: null,
    abgerechnetPL: null,
    leistungsstandDE: null,
    leistungsstandPL: null,
  }
}

type RawRow = Record<string, unknown>

function materialize(raw: RawRow): ProjectRow | null {
  const headerMap: Partial<Record<keyof ProjectRow, unknown>> = {}
  for (const [key, value] of Object.entries(raw)) {
    const norm = normalizeHeader(key)
    const field = IMPORT_COLUMNS[norm]
    if (!field) continue
    headerMap[field] = value
  }

  const projektname = toString(headerMap.projektname)
  const projNr = toString(headerMap.projNr)
  if (!projektname && !projNr) return null

  const row = emptyRow()
  row.projektleiterDE = toString(headerMap.projektleiterDE)
  row.projektleiterPL = toString(headerMap.projektleiterPL)
  row.projektname = projektname
  row.projNr = projNr
  row.leistung = toString(headerMap.leistung)
  row.forecastDE = toNumber(headerMap.forecastDE)
  row.flagDE = toFlag(headerMap.flagDE)
  row.forecastPL = toNumber(headerMap.forecastPL)
  row.flagPL = toFlag(headerMap.flagPL)
  row.abgerechnetDE = toNumber(headerMap.abgerechnetDE)
  row.abgerechnetPL = toNumber(headerMap.abgerechnetPL)
  row.leistungsstandDE = toNumber(headerMap.leistungsstandDE)
  row.leistungsstandPL = toNumber(headerMap.leistungsstandPL)
  return row
}

export type ParseResult = {
  rows: ProjectRow[]
  skipped: number
  unknownHeaders: string[]
}

function parseFromObjects(raws: RawRow[]): ParseResult {
  const rows: ProjectRow[] = []
  let skipped = 0
  const knownKeys = new Set<string>()
  const unknownRaw = new Set<string>()
  for (const raw of raws) {
    for (const key of Object.keys(raw)) {
      const norm = normalizeHeader(key)
      if (IMPORT_COLUMNS[norm]) knownKeys.add(norm)
      else if (key.trim()) unknownRaw.add(key.trim())
    }
    const row = materialize(raw)
    if (row) rows.push(row)
    else skipped++
  }
  return { rows, skipped, unknownHeaders: Array.from(unknownRaw) }
}

export function parseCSV(text: string): ParseResult {
  const lines: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',' || ch === ';' || ch === '\t') {
        row.push(field)
        field = ''
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(field)
        field = ''
        if (row.some((c) => c.length)) lines.push(row)
        row = []
      } else {
        field += ch
      }
    }
  }
  if (field.length || row.length) {
    row.push(field)
    if (row.some((c) => c.length)) lines.push(row)
  }

  if (lines.length === 0) return { rows: [], skipped: 0, unknownHeaders: [] }

  // Detect delimiter: if headers only had one column but the first line contains ';', re-parse with ';'.
  // Our loop above splits on any of , ; \t which handles mixed delimiters per line, so this is fine.

  const headers = lines[0]
  const raws: RawRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const obj: RawRow = {}
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = line[j] ?? ''
    }
    raws.push(obj)
  }
  return parseFromObjects(raws)
}

export function parseXLSX(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { rows: [], skipped: 0, unknownHeaders: [] }
  const sheet = wb.Sheets[sheetName]
  const raws = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '', raw: true })
  return parseFromObjects(raws)
}

export function buildTemplateCSV(): string {
  const header = IMPORT_TEMPLATE_HEADERS.join(',')
  const example = [
    '',
    '',
    'Beispielprojekt',
    '999999',
    'LPH 1-3',
    '12000',
    'w',
    '8000',
    'w',
    '0',
    '0',
    '',
    '',
  ].join(',')
  return `${header}\n${example}\n`
}
