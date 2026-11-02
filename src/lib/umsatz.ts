import type { MonthValues } from '@/types'

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
] as const

export const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'] as const

// Calendar quarter for a given date (defaults to today). Returns 'Q1'..'Q4'.
export function currentCalendarQuarter(date: Date = new Date()): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  return QUARTER_LABELS[Math.floor(date.getMonth() / 3)]
}

// Column indices for quarter boundaries so we can lay out a 12-month grid with
// Q totals inlined after Mar/Jun/Sep/Dec.
export const QUARTER_END_MONTH_INDEX = [2, 5, 8, 11] as const

export function quarterSum(values: MonthValues, q: 0 | 1 | 2 | 3): number {
  const start = q * 3
  return (
    (values[start] ?? 0) + (values[start + 1] ?? 0) + (values[start + 2] ?? 0)
  )
}

export function totalSum(values: MonthValues): number {
  return values.reduce<number>((s, v) => s + (v ?? 0), 0)
}

export function addMonthValues(a: MonthValues, b: MonthValues): MonthValues {
  return Array.from({ length: 12 }, (_, i) => {
    const av = a[i]
    const bv = b[i]
    if (av === null && bv === null) return null
    return (av ?? 0) + (bv ?? 0)
  })
}

export function subMonthValues(a: MonthValues, b: MonthValues): MonthValues {
  return Array.from({ length: 12 }, (_, i) => {
    const av = a[i]
    const bv = b[i]
    if (av === null && bv === null) return null
    return (av ?? 0) - (bv ?? 0)
  })
}

export function cumulativeMonthValues(values: MonthValues): MonthValues {
  const out: MonthValues = []
  let acc = 0
  for (let i = 0; i < 12; i++) {
    acc += values[i] ?? 0
    out.push(acc)
  }
  return out
}
