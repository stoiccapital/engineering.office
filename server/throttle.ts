import type { Sql } from './db'

// Counts failed attempts per key; after MAX failures the key is locked for
// LOCK_MINUTES. Used where there is no user row to count on (legacy login).
const MAX_FAILURES = 10
const LOCK_MINUTES = 15

export const THROTTLE_LOCK_MINUTES = LOCK_MINUTES

export async function isLocked(sql: Sql, keys: string[]): Promise<boolean> {
  if (keys.length === 0) return false
  const rows = await sql`
    select 1 from auth_throttle
    where key in ${sql(keys)} and locked_until > now()
    limit 1
  `
  return rows.length > 0
}

export async function recordFailure(sql: Sql, keys: string[]): Promise<void> {
  for (const key of keys) {
    await sql`
      insert into auth_throttle (key, failures, updated_at) values (${key}, 1, now())
      on conflict (key) do update set
        -- Old failures expire: start counting again after a quiet period.
        failures = case when auth_throttle.updated_at < now() - make_interval(mins => ${LOCK_MINUTES})
                        then 1 else auth_throttle.failures + 1 end,
        updated_at = now()
    `
    await sql`
      update auth_throttle
      set locked_until = now() + make_interval(mins => ${LOCK_MINUTES}), failures = 0
      where key = ${key} and failures >= ${MAX_FAILURES}
    `
  }
}

export async function clearFailures(sql: Sql, keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await sql`delete from auth_throttle where key in ${sql(keys)}`
}

export function clientIp(request: Request): string | null {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}
