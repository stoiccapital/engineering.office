#!/usr/bin/env node
// Smoke test for HR module logic.

let pass = 0
let fail = 0
function assert(cond, label) {
  if (cond) { pass++; console.log(`  ok  ${label}`) }
  else { fail++; console.log(`  FAIL ${label}`) }
}
function section(name) { console.log(`\n== ${name} ==`) }

// ---------- weekBounds (Monday-based, ISO 8601)
section('weekBounds')
function weekBounds(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}
function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
// Wednesday 2026-11-19 → week is Mon 11-17 to Sun 11-23.
const wed = new Date(2026, 10, 19) // month is 0-indexed
const wk = weekBounds(wed)
assert(isoDate(wk.start) === '2026-11-16', `Mon of 2026-11-19 week: ${isoDate(wk.start)}`)
assert(isoDate(wk.end) === '2026-11-22', `Sun of 2026-11-19 week: ${isoDate(wk.end)}`)
// Sunday case: belongs to the week ending that day.
const sun = new Date(2026, 10, 22)
const wk2 = weekBounds(sun)
assert(isoDate(wk2.start) === '2026-11-16', `Sun stays in its week`)
assert(isoDate(wk2.end) === '2026-11-22', `Sun end`)
// Monday case: start = itself.
const mon = new Date(2026, 10, 16)
const wk3 = weekBounds(mon)
assert(isoDate(wk3.start) === '2026-11-16', `Mon = start of its week`)

// ---------- entriesFor
section('entriesFor filter')
function entriesFor(entries, employeeId, range) {
  return entries.filter((e) => {
    if (employeeId && e.employeeId !== employeeId) return false
    if (range && (e.datum < range.start || e.datum > range.end)) return false
    return true
  })
}
const sample = [
  { id: 'a', employeeId: 'AC', datum: '2026-11-16', stunden: 4 },
  { id: 'b', employeeId: 'AC', datum: '2026-11-17', stunden: 4 },
  { id: 'c', employeeId: 'JD', datum: '2026-11-17', stunden: 8 },
  { id: 'd', employeeId: 'AC', datum: '2026-11-23', stunden: 2 }, // outside week
]
const ac = entriesFor(sample, 'AC', { start: '2026-11-16', end: '2026-11-22' })
assert(ac.length === 2, `AC in week: 2 entries (got ${ac.length})`)
const jd = entriesFor(sample, 'JD', { start: '2026-11-16', end: '2026-11-22' })
assert(jd.length === 1, `JD in week: 1 entry`)
const all = entriesFor(sample, null, { start: '2026-11-16', end: '2026-11-22' })
assert(all.length === 3, `all in week: 3 entries (got ${all.length})`)
const acAll = entriesFor(sample, 'AC')
assert(acAll.length === 3, `AC without range: 3 entries`)

// ---------- sumStunden
section('sumStunden')
function sumStunden(entries) {
  return entries.reduce((a, e) => a + (e.stunden ?? 0), 0)
}
assert(sumStunden(ac) === 8, `AC week total = 8h`)
assert(sumStunden(jd) === 8, `JD week total = 8h`)
assert(sumStunden([]) === 0, `empty = 0h`)

// ---------- postUtterance (append-only)
section('postUtterance semantics')
function postUtterance(doc, employeeId, author, text) {
  const trimmed = text.trim()
  if (!trimmed) return doc
  const u = {
    id: Math.random().toString(36).slice(2),
    ts: new Date().toISOString(),
    employeeId: author,
    text: trimmed,
  }
  const i = doc.threads.findIndex((t) => t.employeeId === employeeId)
  if (i === -1) {
    return { ...doc, threads: [...doc.threads, { employeeId, utterances: [u] }] }
  }
  const next = [...doc.threads]
  next[i] = { ...next[i], utterances: [...next[i].utterances, u] }
  return { ...doc, threads: next }
}
let doc = { entries: [], threads: [] }
doc = postUtterance(doc, 'AC', 'MGR', 'Erstes Gespräch – ok')
assert(doc.threads.length === 1, 'first utterance creates thread')
assert(doc.threads[0].employeeId === 'AC', 'thread keyed by employee')
assert(doc.threads[0].utterances.length === 1, 'thread has 1 utterance')
doc = postUtterance(doc, 'AC', 'AC', 'Danke!')
assert(doc.threads[0].utterances.length === 2, 'second utterance appended')
assert(doc.threads[0].utterances[1].employeeId === 'AC', 'second author = AC')
doc = postUtterance(doc, 'AC', 'MGR', '   ')
assert(doc.threads[0].utterances.length === 2, 'whitespace-only ignored')
doc = postUtterance(doc, 'JD', 'MGR', 'Gespräch JD')
assert(doc.threads.length === 2, 'different employee → new thread')

// ---------- normalize (round-trip)
section('normalize')
function normalize(raw) {
  const src = raw ?? {}
  return {
    entries: (src.entries ?? []).map((e) => ({
      id: e.id ?? 'x',
      datum: e.datum ?? '2026-01-01',
      employeeId: e.employeeId ?? '',
      projektId: e.projektId ?? null,
      projekt: e.projekt ?? '',
      stunden: e.stunden ?? 0,
      pause: e.pause ?? 0,
      notiz: e.notiz ?? '',
    })),
    threads: (src.threads ?? []).map((t) => ({
      employeeId: t.employeeId ?? '',
      utterances: (t.utterances ?? []).map((u) => ({
        id: u.id ?? 'y',
        ts: u.ts ?? '',
        employeeId: u.employeeId ?? '',
        text: u.text ?? '',
      })),
    })),
  }
}
const normalized = normalize({})
assert(Array.isArray(normalized.entries) && normalized.entries.length === 0, 'normalize empty doc')
const back = normalize(doc)
assert(back.threads.length === 2, 'normalize preserves thread count')
assert(back.threads[0].utterances.length === 2, 'normalize preserves utterance count')

// ---------- summary
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
