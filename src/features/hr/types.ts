// HR data model — time entries booked against projects + 1:1 conversation
// threads between a manager and an employee. One doc per org (same KV pattern
// as Kostenermittlung).

export type ZeitEntry = {
  id: string
  datum: string // YYYY-MM-DD
  employeeId: string // RosterEmployee.id — stable even if kuerzel changes or
  // isn't assigned yet (not every roster entry has a login/kuerzel).
  projektId: string | null // ProjektlisteRow.id; null = non-project time
  projekt: string // frozen project name (keeps the entry readable if the row
  // later gets renamed or deleted from Projektliste)
  stunden: number
  pause: number // Pausenzeit in Stunden, informational only, not subtracted
  // from `stunden`
  notiz: string
}

export type Utterance = {
  id: string
  ts: string // ISO datetime
  author: string // free-form label (displayName / kuerzel / id) — display only
  text: string
}

export type Gespraechsthread = {
  employeeId: string
  utterances: Utterance[]
}

export type HrDoc = {
  entries: ZeitEntry[]
  threads: Gespraechsthread[]
  updatedAt?: string
}
