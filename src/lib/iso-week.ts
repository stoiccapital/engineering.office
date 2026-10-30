// ISO 8601 week helpers. ISO week starts Monday; week 1 is the week containing
// the first Thursday of the year. A year has 52 or 53 ISO weeks.

export const MONTH_LABELS_DE = [
  'Jan',
  'Feb',
  'März',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Okt',
  'Nov',
  'Dez',
] as const

function isoWeekOf(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayN = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayN + 3)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const yearStartDayN = (yearStart.getUTCDay() + 6) % 7
  yearStart.setUTCDate(yearStart.getUTCDate() - yearStartDayN + 3)
  return 1 + Math.round((d.getTime() - yearStart.getTime()) / (7 * 24 * 3600 * 1000))
}

export function weeksInISOYear(year: number): number {
  return isoWeekOf(new Date(Date.UTC(year, 11, 28)))
}

// Returns the Monday (as UTC Date) of ISO week `week` in `year`.
export function mondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Dow = (jan4.getUTCDay() + 6) % 7 // 0=Mon
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow)
  const d = new Date(week1Monday)
  d.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return d
}

// ISO 8601: the month that owns the week is the month of its Thursday.
export function monthOfISOWeek(year: number, week: number): number {
  const monday = mondayOfISOWeek(year, week)
  const thursday = new Date(monday)
  thursday.setUTCDate(monday.getUTCDate() + 3)
  return thursday.getUTCMonth()
}

export type QuarterLabel = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export function quarterOfISOWeek(year: number, week: number): QuarterLabel {
  const m = monthOfISOWeek(year, week)
  if (m <= 2) return 'Q1'
  if (m <= 5) return 'Q2'
  if (m <= 8) return 'Q3'
  return 'Q4'
}

// Returns the ISO year + ISO week number for today.
export function currentISOWeek(now: Date = new Date()): { year: number; week: number } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayN = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayN + 3)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const yearStartDayN = (yearStart.getUTCDay() + 6) % 7
  yearStart.setUTCDate(yearStart.getUTCDate() - yearStartDayN + 3)
  return {
    year: d.getUTCFullYear(),
    week: 1 + Math.round((d.getTime() - yearStart.getTime()) / (7 * 24 * 3600 * 1000)),
  }
}
