// European-format EUR currency; blank for null/0 to keep sheet uncluttered.
// Numbers ≥ 1000 use narrow non-breaking space as thousands separator.
export function fmtEUR(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  if (v === 0) return '0'
  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 0,
  }).format(v)
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
