import type { Gespraechsthread, HrDoc, Utterance, ZeitEntry } from '../types'

export function emptyDoc(): HrDoc {
  return { entries: [], threads: [] }
}

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

// Legacy docs may carry kuerzel-keyed entries/threads (pre-v2 HR shape); map
// them to the new employeeId shape on load so no data is lost.
type LegacyEntry = Partial<ZeitEntry> & { kuerzel?: string }
type LegacyUtterance = Partial<Utterance> & { kuerzel?: string }
type LegacyThread = {
  employeeId?: string
  employeeKuerzel?: string
  utterances?: LegacyUtterance[]
}
type LegacyDoc = {
  entries?: LegacyEntry[]
  threads?: LegacyThread[]
  updatedAt?: string
}

export function normalize(raw: unknown): HrDoc {
  const src = (raw ?? {}) as LegacyDoc
  return {
    entries: (src.entries ?? []).map((e) => ({
      id: e.id ?? genId(),
      datum: e.datum ?? todayISO(),
      employeeId: e.employeeId ?? e.kuerzel ?? '',
      projektId: e.projektId ?? null,
      projekt: e.projekt ?? '',
      stunden: e.stunden ?? 0,
      pause: e.pause ?? 0,
      notiz: e.notiz ?? '',
    })),
    threads: (src.threads ?? []).map((t) => ({
      employeeId: t.employeeId ?? t.employeeKuerzel ?? '',
      utterances: (t.utterances ?? []).map((u) => ({
        id: u.id ?? genId(),
        ts: u.ts ?? new Date().toISOString(),
        author: u.author ?? u.kuerzel ?? '',
        text: u.text ?? '',
      })),
    })),
    updatedAt: src.updatedAt,
  }
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Monday-based week boundaries — ISO 8601 (matches how the rest of the app
// reasons about weeks in Quartalsplanung).
export function weekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Monday=0..Sunday=6
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function entriesFor(
  doc: HrDoc,
  employeeId: string | null,
  range?: { start: string; end: string },
): ZeitEntry[] {
  return doc.entries.filter((e) => {
    if (employeeId && e.employeeId !== employeeId) return false
    if (range && (e.datum < range.start || e.datum > range.end)) return false
    return true
  })
}

export function sumStunden(entries: ZeitEntry[]): number {
  return entries.reduce((a, e) => a + (e.stunden ?? 0), 0)
}

export function findOrCreateThread(doc: HrDoc, employeeId: string): Gespraechsthread {
  const existing = doc.threads.find((t) => t.employeeId === employeeId)
  if (existing) return existing
  return { employeeId, utterances: [] }
}

export function buildUtterance(author: string, text: string): Utterance {
  return {
    id: genId(),
    ts: new Date().toISOString(),
    author,
    text,
  }
}
