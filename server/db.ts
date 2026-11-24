import postgres from 'postgres'
import type { Env } from './env'

export type Sql = postgres.Sql

// One small client per request: Workers can't keep sockets across requests,
// and Hyperdrive pools on its side.
export function createSql(env: Env): Sql {
  const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL
  if (!url) throw new Error('database not configured (HYPERDRIVE or DATABASE_URL)')
  return postgres(url, {
    max: 1,
    fetch_types: false,
    idle_timeout: 5,
    connect_timeout: 10,
    onnotice: () => {},
  })
}

// Postgres array literal for a text[] parameter. postgres.js can't infer
// array types with fetch_types disabled, so pass `${pgTextArray(xs)}::text[]`.
export function pgTextArray(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`
}
