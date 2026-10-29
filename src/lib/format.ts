// European-format EUR currency; blank for null/0 to keep sheet uncluttered.
// Numbers ≥ 1000 use narrow non-breaking space as thousands separator.
export function fmtEUR(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  if (v === 0) return '0'
  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 0,
  }).format(v)
}

// Compact European notation per global rule: 1 500 → "1,5 k", 2 000 000 → "2,0 m"
// Numbers < 1000 pass through to fmtEUR for a plain thousands format.
export function fmtCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  const abs = Math.abs(v)
  if (abs < 1000) return fmtEUR(v)
  const fmt = (n: number, unit: string) =>
    new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n) + ' ' + unit
  if (abs < 1_000_000) return fmt(v / 1000, 'k')
  if (abs < 1_000_000_000) return fmt(v / 1_000_000, 'm')
  if (abs < 1_000_000_000_000) return fmt(v / 1_000_000_000, 'b')
  return fmt(v / 1_000_000_000_000, 't')
}

export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(v)
}

// Parse user input like "55.000", "55 000", "55000", "55k" → 55000
export function parseNum(input: string): number | null {
  const s = input.trim()
  if (!s) return null
  const cleaned = s.replace(/[.\s\u202f\u00a0]/g, '').replace(',', '.')
  if (/^-?\d+(\.\d+)?[kKmM]?$/.test(cleaned)) {
    const mult = cleaned.endsWith('k') || cleaned.endsWith('K') ? 1000
      : cleaned.endsWith('m') || cleaned.endsWith('M') ? 1_000_000
      : 1
    const num = parseFloat(cleaned.replace(/[kKmM]$/, ''))
    return Number.isFinite(num) ? num * mult : null
  }
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

// Parse percent input: "30", "30%", "0,3", "0.3" → 0.3
export function parsePct(input: string): number | null {
  const s = input.trim()
  if (!s) return null
  const hasPct = s.endsWith('%')
  const cleaned = s.replace('%', '').replace(/[.\s\u202f\u00a0]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  if (!Number.isFinite(num)) return null
  if (hasPct) return num / 100
  if (num > 1) return num / 100
  return num
}
