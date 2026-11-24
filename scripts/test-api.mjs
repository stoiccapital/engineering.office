#!/usr/bin/env node
// End-to-end API test against a running local stack:
//   docker compose up -d && pnpm db:migrate && pnpm build && pnpm dev:full
//   node scripts/test-api.mjs
// Wipes the LOCAL database first (refuses to run against a non-local host).
import postgres from 'postgres'
import { databaseUrl } from './lib/env.mjs'
import { hashPassword } from './lib/password.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:8788'
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8026'

const dbUrl = databaseUrl()
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  console.error('refusing to wipe a non-local database')
  process.exit(1)
}

let pass = 0
let fail = 0
function check(cond, label, extra) {
  if (cond) {
    pass++
    console.log(`  ok   ${label}`)
  } else {
    fail++
    console.log(`  FAIL ${label}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ''}`)
  }
}
const section = (s) => console.log(`\n== ${s} ==`)

// Minimal cookie-jar client: one per simulated browser.
function client() {
  let cookie = ''
  return async function call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) {
      const [pair] = set.split(';')
      cookie = pair.endsWith('=') ? '' : pair
    }
    const text = await res.text()
    let json
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
    return { status: res.status, json, setCookie: set, headers: res.headers }
  }
}

async function latestMailLink(to, param) {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()
    for (const m of list.messages ?? []) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()
      const match = (full.Text ?? '').match(new RegExp(`[?&]${param}=([^\\s&]+)`))
      if (match) return decodeURIComponent(match[1])
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} })
await sql`truncate users, roles, sessions, auth_tokens, legacy_logins, documents, document_history, document_conflicts, auth_throttle, activity_events, kv_archive restart identity cascade`
await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' })

const admin = client()
const other = client()
const anon = client()

section('bootstrap: first account becomes admin')
check((await anon('GET', '/api/auth/me')).json.user === null, 'me is null without session')
check((await anon('GET', '/api/plan/2026')).status === 401, 'module API requires session')
let r = await admin('POST', '/api/auth/register', { email: 'Chef@Ingenieurbuero-Example.de', password: 'sehr-geheim-1', displayName: 'Chef' })
check(r.status === 200 && r.json.verificationRequired === true, 'register with a company (non-Gmail) address', r.json)
r = await admin('POST', '/api/auth/login', { email: 'chef@ingenieurbuero-example.de', password: 'sehr-geheim-1' })
check(r.status === 403 && r.json.error === 'email_unverified', 'login blocked until email verified', r.json)
const verifyToken = await latestMailLink('chef@ingenieurbuero-example.de', 'verify')
check(Boolean(verifyToken), 'verification email delivered (Mailpit)')
r = await admin('POST', '/api/auth/verify-email', { token: verifyToken })
check(r.status === 200 && r.json.user?.role?.id === 'admin', 'verify signs in as admin', r.json)
check(/HttpOnly/.test(r.setCookie ?? '') && /SameSite=Lax/.test(r.setCookie ?? ''), 'session cookie is HttpOnly + SameSite=Lax')
r = await admin('POST', '/api/auth/verify-email', { token: verifyToken })
check(r.status === 400, 'verification token is single-use')

section('documents')
const plan = { year: 2026, employees: [{ name: 'A' }], cells: { '0:1': { x: 1.5 } }, todos: {}, ünïcödé: 'ß€' }
r = await admin('PUT', '/api/plan/2026', plan)
check(r.status === 200, 'PUT plan-2026')
r = await admin('GET', '/api/plan/2026')
check(JSON.stringify(r.json) === JSON.stringify(plan) || deepEqual(r.json, plan), 'GET returns identical document', r.json)
check((await admin('GET', '/api/plan/2025')).json === null, 'missing document returns null')
check((await admin('GET', '/api/plan/20x6')).status === 400, 'bad key rejected')
r = await admin('PUT', '/api/plan/2026', { ...plan, cells: {} })
const [doc] = await sql`select version from documents where key = 'plan-2026'`
const hist = await sql`select version, reason from document_history where key = 'plan-2026'`
check(doc.version === 2 && hist.length === 1 && hist[0].version === 1, 'overwrite bumps version and keeps previous version in history', { doc, hist })
r = await admin('PUT', '/api/plan/2026', 'not json', { 'content-type': 'application/json' })
check(r.status === 400, 'invalid JSON rejected')
r = await admin('PUT', '/api/plan/2026', JSON.stringify(plan), { 'content-type': 'text/plain' })
check(r.status === 415, 'non-JSON content type rejected (CSRF guard)')
r = await admin('PUT', '/api/plan/2026', { big: 'x'.repeat(600_000) })
check(r.status === 413, 'size limit enforced')
for (const [path, body] of [
  ['/api/period/2026-Q1', { rows: [1] }],
  ['/api/ziele/2026', { a: 1 }],
  ['/api/umsatz/2026', { a: 2 }],
  ['/api/rechnungsplan/2026-11', { a: 3 }],
  ['/api/hr', { a: 4 }],
  ['/api/kostenschaetzung', { a: 5 }],
  ['/api/kostenermittlung', { a: 6 }],
  ['/api/katalog-overrides', { a: 7 }],
  ['/api/projektliste', { a: 8 }],
]) {
  await admin('PUT', path, body)
  check(deepEqual((await admin('GET', path)).json, body), `round-trip ${path}`)
}
const keys = (await sql`select key from documents order by key`).map((x) => x.key)
check(
  ['2026-Q1', 'hr', 'katalogOverrides', 'kostenermittlung', 'kostenschaetzung', 'plan-2026', 'projektliste', 'rechnungsplan-2026-11', 'umsatz-2026', 'ziele-2026'].every((k) => keys.includes(k)),
  'documents stored under the original KV key names',
  keys,
)

section('concurrent edits (optimistic locking)')
const tabA = (await admin('GET', '/api/ziele/2026'))
const tabB = (await admin('GET', '/api/ziele/2026'))
const vA = tabA.headers.get('x-doc-version')
check(vA !== null && vA === tabB.headers.get('x-doc-version'), 'GET returns x-doc-version', vA)
r = await admin('PUT', '/api/ziele/2026', { by: 'A' }, { 'x-doc-version': vA })
check(r.status === 200 && r.json.version === Number(vA) + 1, 'save based on current version succeeds', r.json)
r = await admin('PUT', '/api/ziele/2026', { by: 'B' }, { 'x-doc-version': vA })
check(r.status === 409 && r.json.error === 'conflict', 'stale save is refused instead of overwriting', r.json)
check(deepEqual((await admin('GET', '/api/ziele/2026')).json, { by: 'A' }), 'first save survives')
const [conf] = await sql`select data, based_on_version, current_version from document_conflicts where key = 'ziele-2026'`
check(conf && deepEqual(conf.data, { by: 'B' }), 'refused payload kept in document_conflicts', conf)
r = await admin('PUT', '/api/ziele/2030', { neu: 1 }, { 'x-doc-version': '0' })
check(r.status === 200, 'version 0 creates a new document')
r = await admin('PUT', '/api/ziele/2030', { neu: 2 }, { 'x-doc-version': '0' })
check(r.status === 409, 'version 0 refused when document exists meanwhile')
const rv = (await admin('GET', '/api/roster')).headers.get('x-doc-version')
r = await admin('PUT', '/api/roster', { locations: [], teams: [], employees: [] }, { 'x-doc-version': String(Number(rv) + 5) })
check(r.status === 409, 'roster also protected')

section('logo')
check((await anon('GET', '/api/logo')).json.dataUrl === null, 'logo is public, empty')
await admin('PUT', '/api/logo', { dataUrl: 'data:image/png;base64,AAAA' })
check((await anon('GET', '/api/logo')).json.dataUrl === 'data:image/png;base64,AAAA', 'logo saved')
check((await admin('PUT', '/api/logo', { dataUrl: 'javascript:alert(1)' })).status === 400, 'non-image logo rejected')
await admin('DELETE', '/api/logo')
check((await anon('GET', '/api/logo')).json.dataUrl === null, 'logo deleted')

section('roles & roster')
r = await admin('GET', '/api/settings/access')
check(r.json.roles.length === 1 && r.json.roles[0].password === '', 'roles listed, no password exposed', r.json)
r = await admin('PUT', '/api/settings/access', {
  roles: [
    { id: 'admin', name: 'Admin', modules: r.json.roles[0].modules },
    { id: 'pl', name: 'Projektleiter', password: 'ignored', modules: ['plan', 'projektliste'] },
  ],
})
check(r.status === 200, 'add role')
r = await admin('PUT', '/api/settings/access', { roles: [{ id: 'pl', name: 'Projektleiter', modules: ['plan'] }] })
check(r.status === 409, 'cannot remove the last admin role', r.json)
await admin('PUT', '/api/roster', {
  locations: [],
  teams: [],
  employees: [{ id: 'e1', vorname: 'Paula', name: 'Lenz', kuerzel: 'PL', password: 'klartext', roleId: 'pl' }],
})
r = await admin('GET', '/api/roster')
check(r.json.employees[0].kuerzel === 'PL' && !('password' in r.json.employees[0]), 'roster saved without plaintext password', r.json)

section('second account: waits for approval, then gets a role')
r = await other('POST', '/api/auth/register', { email: 'paula.lenz@gmx.net', password: 'kurz' })
check(r.status === 400, 'weak password rejected')
r = await other('POST', '/api/auth/register', { email: 'paula.lenz@gmx.net', password: 'noch-geheimer-2', displayName: 'Paula Lenz' })
check(r.status === 200, 'register (GMX address)')
r = await other('POST', '/api/auth/verify-email', { token: await latestMailLink('paula.lenz@gmx.net', 'verify') })
check(r.status === 200 && r.json.user.role === null, 'verified account has no role yet', r.json)
r = await other('GET', '/api/plan/2026')
check(r.status === 403 && r.json.error === 'no role', 'no-role account blocked from modules', r.json)
r = await other('GET', '/api/settings/accounts')
check(r.status === 403, 'no-role account cannot list accounts')
r = await admin('GET', '/api/settings/accounts')
const paula = r.json.accounts.find((a) => a.email === 'paula.lenz@gmx.net')
check(r.status === 200 && paula && r.json.employees.length === 1, 'admin lists accounts + employees', r.json)
r = await admin('PATCH', `/api/settings/accounts/${paula.id}`, { employeeId: 'e1' })
check(r.status === 200, 'admin links account to Mitarbeiter')
r = await other('GET', '/api/auth/me')
check(r.json.user.role?.id === 'pl' && r.json.user.kuerzel === 'PL', 'role follows the employee roleId; kuerzel resolved', r.json)
check((await other('GET', '/api/plan/2026')).status === 200, 'plan readable with plan module')
check((await other('GET', '/api/hr')).status === 200, 'paths without module rule open to any role (as before)')
check((await other('GET', '/api/period/2026-Q1')).status === 403, 'forecast blocked without module')
check((await other('GET', '/api/settings/access')).status === 403, 'settings blocked without module')
// Changing the role in the Mitarbeiter screen updates the linked account.
const roster = (await admin('GET', '/api/roster')).json
roster.employees[0].roleId = 'admin'
await admin('PUT', '/api/roster', roster)
check((await other('GET', '/api/auth/me')).json.user.role?.id === 'admin', 'roster roleId change propagates to account')
r = await admin('PATCH', `/api/settings/accounts/${paula.id}`, { roleId: 'pl' })
check(r.status === 200 && (await admin('GET', '/api/roster')).json.employees[0].roleId === 'pl', 'role change on account writes back to Mitarbeiter')
const adminMe = (await admin('GET', '/api/auth/me')).json.user
check((await admin('PATCH', `/api/settings/accounts/${adminMe.id}`, { roleId: 'pl' })).status === 409, 'admin cannot remove own settings access')
check((await admin('DELETE', `/api/settings/accounts/${adminMe.id}`)).status === 409, 'admin cannot delete self')

section('activity')
await other('POST', '/api/activity', { kind: 'action', user: 'SPOOFED', module: 'plan', action: 'todo.add' })
r = await admin('GET', '/api/activity?days=1')
const ev = r.json.find((e) => e.action === 'todo.add')
check(ev && ev.user === 'PL', 'activity actor taken from session, not body', ev)
check(r.json.some((e) => e.kind === 'login'), 'logins recorded')
check((await other('GET', '/api/activity')).status === 403, 'activity log admin-only')

section('password reset')
r = await anon('POST', '/api/auth/forgot-password', { email: 'nobody@example.org' })
check(r.status === 200, 'forgot-password does not reveal unknown emails')
await anon('POST', '/api/auth/forgot-password', { email: 'paula.lenz@gmx.net' })
const resetToken = await latestMailLink('paula.lenz@gmx.net', 'reset')
check(Boolean(resetToken), 'reset email delivered')
r = await anon('POST', '/api/auth/reset-password', { token: resetToken, password: 'ganz-neu-3333' })
check(r.status === 200 && r.json.user.email === 'paula.lenz@gmx.net', 'reset sets password and signs in')
check((await other('GET', '/api/auth/me')).json.user === null, 'old sessions revoked after reset')
r = await other('POST', '/api/auth/login', { email: 'PAULA.LENZ@gmx.net', password: 'ganz-neu-3333' })
check(r.status === 200, 'login with new password (email case-insensitive)')

section('lockout & logout')
for (let i = 0; i < 10; i++) await anon('POST', '/api/auth/login', { email: 'paula.lenz@gmx.net', password: 'falsch' })
r = await anon('POST', '/api/auth/login', { email: 'paula.lenz@gmx.net', password: 'ganz-neu-3333' })
check(r.status === 429, 'account locked after 10 failures', r.json)
await sql`update users set locked_until = null where email = 'paula.lenz@gmx.net'`
await other('POST', '/api/auth/logout', {})
check((await other('GET', '/api/auth/me')).json.user === null, 'logout ends session')
r = await admin('PATCH', `/api/settings/accounts/${paula.id}`, { status: 'disabled' })
r = await other('POST', '/api/auth/login', { email: 'paula.lenz@gmx.net', password: 'ganz-neu-3333' })
check(r.status === 403 && r.json.error === 'disabled', 'disabled account cannot sign in')

section('legacy Kürzel login throttle')
await sql`insert into legacy_logins (kuerzel, password_hash, source) values ('TT', ${hashPassword('alt-pw')}, 'roster')`
for (let i = 0; i < 10; i++) await anon('POST', '/api/auth/legacy-login', { kuerzel: 'TT', password: 'falsch' })
r = await anon('POST', '/api/auth/legacy-login', { kuerzel: 'TT', password: 'alt-pw' })
check(r.status === 429, 'legacy login locked after 10 failures', r.json)
await sql`delete from auth_throttle`
r = await anon('POST', '/api/auth/legacy-login', { kuerzel: 'TT', password: 'alt-pw' })
check(r.status === 200 && r.json.claimToken, 'legacy login works again after lock expires')

section('cron endpoints')
check((await anon('POST', '/api/admin/backup', {})).status === 401, 'backup requires secret')
r = await anon('POST', '/api/admin/backup', {}, { 'x-backup-secret': 'dev-backup-secret' })
check(r.status === 200 && r.json.snapshotCount > 0, 'backup snapshots documents', r.json)
r = await anon('POST', '/api/admin/weekly-rollover', {}, { 'x-backup-secret': 'dev-backup-secret' })
check(r.status === 200 && r.json.ok, 'weekly rollover runs on Postgres', r.json)

await sql.end()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual(a[k], b[k]))
}
