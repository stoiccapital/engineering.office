#!/usr/bin/env node
// Imports a KV dump (scripts/kv-export.mjs) into Postgres and verifies it,
// all inside ONE transaction: if any check fails, nothing is committed.
//
//   node scripts/kv-import.mjs --file backups/kv-export-….json [--dry-run]
//
// What goes where:
//   every key, verbatim          → kv_archive (audit copy, never modified)
//   settings:access roles        → roles (shared role passwords hashed)
//   settings:access users        → legacy_logins (passwords hashed)
//   roster                       → documents['roster'] without passwords,
//                                  Kürzel logins → legacy_logins (hashed)
//   activity-YYYY-MM-DD          → activity_events
//   settings:logo (raw data URL) → documents['settings:logo'] as JSON string
//   bak-* snapshots              → kv_archive only
//   everything else (JSON)       → documents, same key, unchanged
//
// Refuses to run on a database that already has data in these tables.
import crypto from 'node:crypto'
import fs from 'node:fs'
import postgres from 'postgres'
import { databaseUrl, parseArgs } from './lib/env.mjs'
import { hashPassword, verifyPassword } from './lib/password.mjs'

const args = parseArgs()
if (!args.file) {
  console.error('usage: node scripts/kv-import.mjs --file <kv-export.json> [--dry-run]')
  process.exit(1)
}
const dump = JSON.parse(fs.readFileSync(args.file, 'utf8'))
if (!Array.isArray(dump.keys) || dump.keys.length !== dump.keyCount) {
  console.error('dump is malformed or truncated (keyCount mismatch)')
  process.exit(1)
}
for (const k of dump.keys) {
  const sha = crypto.createHash('sha256').update(k.value, 'utf8').digest('hex')
  if (sha !== k.sha256) {
    console.error(`dump corrupted: checksum mismatch for ${k.key}`)
    process.exit(1)
  }
}

const KNOWN = [
  /^plan-\d{4}$/, /^ziele-\d{4}$/, /^umsatz-\d{4}$/, /^rechnungsplan-\d{4}-\d{2}$/, /^\d{4}-Q[1-4]$/,
  /^(hr|roster|kostenschaetzung|kostenermittlung|katalogOverrides|projektliste)$/,
]

const report = { archived: 0, documents: [], unknownDocuments: [], nonJson: [], roles: 0, roleLegacyPasswords: 0, legacyLogins: 0, duplicateKuerzel: [], activityEvents: 0, backupKeys: 0, warnings: [] }

const plan = { archive: [], documents: new Map(), roles: [], legacy: [], activity: [] }
const byKey = new Map(dump.keys.map((k) => [k.key, k.value]))

for (const { key, value } of dump.keys) {
  plan.archive.push({ key, value })
  if (key.startsWith('bak-')) {
    report.backupKeys++
    continue
  }
  if (/^activity-\d{4}-\d{2}-\d{2}$/.test(key)) {
    let arr
    try {
      arr = JSON.parse(value)
    } catch {
      report.warnings.push(`${key}: not JSON, kept in kv_archive only`)
      continue
    }
    for (const ev of Array.isArray(arr) ? arr : []) {
      if (!ev || typeof ev.ts !== 'string' || !['login', 'view', 'action'].includes(ev.kind)) {
        report.warnings.push(`${key}: skipped malformed event ${JSON.stringify(ev).slice(0, 80)} (still in kv_archive)`)
        continue
      }
      plan.activity.push({
        ts: ev.ts,
        user_label: String(ev.user ?? '').slice(0, 64) || '?',
        kind: ev.kind,
        module: ev.module ?? null,
        action: ev.action ?? null,
        target: ev.target ?? null,
      })
    }
    continue
  }
  if (key === 'settings:access') continue // handled below
  if (key === 'settings:logo') {
    plan.documents.set(key, value) // raw data URL → JSON string document
    continue
  }
  let parsed
  try {
    parsed = JSON.parse(value)
  } catch {
    report.nonJson.push(key)
    plan.documents.set(key, value) // keep as JSON string so nothing is dropped
    continue
  }
  if (key === 'roster' && parsed && Array.isArray(parsed.employees)) {
    for (const e of parsed.employees) {
      if (e && typeof e.kuerzel === 'string' && e.kuerzel && typeof e.password === 'string' && e.password) {
        plan.legacy.push({
          kuerzel: e.kuerzel,
          password: e.password,
          display_name: [e.vorname, e.name].filter((s) => typeof s === 'string' && s.trim()).join(' ') || e.kuerzel,
          employee_id: typeof e.id === 'string' ? e.id : null,
          role_id: typeof e.roleId === 'string' && e.roleId ? e.roleId : null,
          source: 'roster',
        })
      }
      if (e && 'password' in e) delete e.password
    }
  }
  if (!KNOWN.some((re) => re.test(key))) report.unknownDocuments.push(key)
  plan.documents.set(key, parsed)
}

const accessRaw = byKey.get('settings:access')
if (accessRaw) {
  const cfg = JSON.parse(accessRaw)
  ;(cfg.roles ?? []).forEach((r, i) => {
    plan.roles.push({
      id: String(r.id),
      name: String(r.name ?? ''),
      modules: Array.isArray(r.modules) ? r.modules.map(String) : [],
      password: typeof r.password === 'string' && r.password ? r.password : null,
      sort_order: i,
    })
  })
  for (const u of cfg.users ?? []) {
    if (!u || typeof u.kuerzel !== 'string' || !u.kuerzel || typeof u.password !== 'string' || !u.password) continue
    plan.legacy.push({
      kuerzel: u.kuerzel,
      password: u.password,
      display_name: [u.vorname, u.name].filter((s) => typeof s === 'string' && s.trim()).join(' ') || u.kuerzel,
      employee_id: null,
      role_id: typeof u.roleId === 'string' && u.roleId ? u.roleId : null,
      source: 'access_users',
    })
  }
}
const roleIds = new Set(plan.roles.map((r) => r.id))
for (const l of plan.legacy) {
  if (l.role_id && !roleIds.has(l.role_id)) {
    report.warnings.push(`login ${l.kuerzel}: roleId ${l.role_id} no longer exists — imported without role`)
    l.role_id = null
  }
}
const seen = new Map()
for (const l of plan.legacy) seen.set(l.kuerzel, (seen.get(l.kuerzel) ?? 0) + 1)
report.duplicateKuerzel = [...seen].filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`)

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} })
const ROLLBACK = Symbol('dry-run')
let failures = []
try {
  await sql.begin(async (tx) => {
    const [counts] = await tx`
      select (select count(*)::int from documents) d, (select count(*)::int from roles) r,
             (select count(*)::int from users) u, (select count(*)::int from kv_archive) a,
             (select count(*)::int from legacy_logins) l
    `
    if (counts.d + counts.r + counts.u + counts.a + counts.l > 0) {
      throw new Error(`target database is not empty (${JSON.stringify(counts)}); refusing to import`)
    }

    for (const a of plan.archive) await tx`insert into kv_archive (key, value) values (${a.key}, ${a.value})`
    report.archived = plan.archive.length

    for (const r of plan.roles) {
      await tx`
        insert into roles (id, name, modules, legacy_password_hash, sort_order)
        values (${r.id}, ${r.name}, (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(${tx.json(r.modules)}) x),
                ${r.password ? hashPassword(r.password) : null}, ${r.sort_order})
      `
      if (r.password) report.roleLegacyPasswords++
    }
    report.roles = plan.roles.length

    for (const l of plan.legacy) {
      await tx`
        insert into legacy_logins (kuerzel, password_hash, display_name, employee_id, role_id, source)
        values (${l.kuerzel}, ${hashPassword(l.password)}, ${l.display_name}, ${l.employee_id}, ${l.role_id}, ${l.source})
      `
    }
    report.legacyLogins = plan.legacy.length

    for (const [key, data] of plan.documents) {
      await tx`insert into documents (key, data) values (${key}, (${JSON.stringify(data)}::text)::jsonb)`
      report.documents.push(key)
    }

    for (const ev of plan.activity) {
      await tx`
        insert into activity_events (ts, user_label, kind, module, action, target)
        values (${ev.ts}::timestamptz, ${ev.user_label}, ${ev.kind}, ${ev.module}, ${ev.action}, ${ev.target})
      `
    }
    report.activityEvents = plan.activity.length

    // ---------------------------------------------------------- verification
    const fail = (m) => failures.push(m)
    const arch = await tx`select key, value from kv_archive`
    if (arch.length !== dump.keys.length) fail(`kv_archive has ${arch.length} rows, dump has ${dump.keys.length}`)
    const archMap = new Map(arch.map((r) => [r.key, r.value]))
    for (const k of dump.keys) if (archMap.get(k.key) !== k.value) fail(`kv_archive value differs for ${k.key}`)

    const docs = await tx`select key, data::text as data from documents`
    if (docs.length !== plan.documents.size) fail(`documents: ${docs.length} rows, expected ${plan.documents.size}`)
    const docMap = new Map(docs.map((r) => [r.key, JSON.parse(r.data)]))
    for (const [key, expected] of plan.documents) {
      if (!deepEqual(docMap.get(key), expected)) fail(`document ${key} differs from KV value`)
    }
    // Roster: everything except the password field must survive untouched.
    if (byKey.has('roster')) {
      const original = JSON.parse(byKey.get('roster'))
      if (original && Array.isArray(original.employees)) {
        for (const e of original.employees) delete e?.password
      }
      if (!deepEqual(docMap.get('roster'), original)) fail('roster (minus passwords) differs from KV value')
    }

    const dbRoles = await tx`select id, name, to_jsonb(modules) as modules, legacy_password_hash from roles`
    if (dbRoles.length !== plan.roles.length) fail(`roles: ${dbRoles.length}, expected ${plan.roles.length}`)
    for (const r of plan.roles) {
      const d = dbRoles.find((x) => x.id === r.id)
      if (!d || d.name !== r.name || !deepEqual(d.modules, r.modules)) fail(`role ${r.id} differs`)
      else if (r.password && !verifyPassword(r.password, d.legacy_password_hash)) fail(`role ${r.id} password hash does not verify`)
    }

    const dbLegacy = await tx`select kuerzel, password_hash, employee_id from legacy_logins`
    if (dbLegacy.length !== plan.legacy.length) fail(`legacy_logins: ${dbLegacy.length}, expected ${plan.legacy.length}`)
    for (const l of plan.legacy) {
      const ok = dbLegacy.some((d) => d.kuerzel === l.kuerzel && d.employee_id === l.employee_id && verifyPassword(l.password, d.password_hash))
      if (!ok) fail(`legacy login ${l.kuerzel} does not verify`)
    }

    const [{ n }] = await tx`select count(*)::int as n from activity_events`
    if (n !== plan.activity.length) fail(`activity_events: ${n}, expected ${plan.activity.length}`)

    const leaked = await tx`select key from documents where data::text ~ '"password"\\s*:\\s*"[^"]+"'`
    if (leaked.length) report.warnings.push(`documents still containing a non-empty "password" field: ${leaked.map((r) => r.key).join(', ')}`)

    if (failures.length) throw new Error('verification failed')
    if (args['dry-run']) throw ROLLBACK
  })
  printReport()
  console.log(`\n✔ import committed and verified (${dump.keys.length} KV keys)`)
} catch (e) {
  if (e === ROLLBACK) {
    printReport()
    console.log('\n✔ dry run: everything verified, transaction rolled back (nothing written)')
  } else {
    printReport()
    for (const f of failures) console.error(`  ✘ ${f}`)
    console.error(`\n✘ import aborted, nothing written: ${e.message}`)
    process.exitCode = 1
  }
} finally {
  await sql.end()
}

function printReport() {
  console.log(`source: ${dump.source} namespace ${dump.namespaceId}, exported ${dump.exportedAt}`)
  console.log(`  kv_archive rows         ${report.archived} (of which bak-* snapshots: ${report.backupKeys})`)
  console.log(`  documents               ${report.documents.length}: ${report.documents.sort().join(', ')}`)
  console.log(`  roles                   ${report.roles} (${report.roleLegacyPasswords} with shared role password)`)
  console.log(`  legacy Kürzel logins    ${report.legacyLogins}${report.duplicateKuerzel.length ? ` (duplicate Kürzel: ${report.duplicateKuerzel.join(', ')})` : ''}`)
  console.log(`  activity events         ${report.activityEvents}`)
  if (report.unknownDocuments.length) console.log(`  unrecognised keys kept as documents: ${report.unknownDocuments.join(', ')}`)
  if (report.nonJson.length) console.log(`  non-JSON values kept as string documents: ${report.nonJson.join(', ')}`)
  for (const w of report.warnings) console.log(`  ! ${w}`)
}

function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]))
}
