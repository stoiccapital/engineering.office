#!/usr/bin/env node
// Applies db/migrations/*.sql in order, each in its own transaction, and
// records applied files in schema_migrations. Safe to re-run.
//
//   node scripts/db-migrate.mjs            # uses DATABASE_URL or .dev.vars
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { ROOT, databaseUrl } from './lib/env.mjs'

const dir = path.join(ROOT, 'db', 'migrations')
const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} })

try {
  await sql`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`
  const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name))
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  let count = 0
  for (const f of files) {
    if (applied.has(f)) continue
    const body = fs.readFileSync(path.join(dir, f), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(body)
      await tx`insert into schema_migrations (name) values (${f})`
    })
    console.log(`applied ${f}`)
    count++
  }
  console.log(count ? `${count} migration(s) applied` : 'database is up to date')
} finally {
  await sql.end()
}
