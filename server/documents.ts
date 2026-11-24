import type { Sql } from './db'
import { HttpError } from './http'

// Module data is stored as one JSON document per former KV key, so the
// frontend keeps reading / writing exactly the same shapes as before.

// Before overwriting, keep the previous version in document_history unless a
// history row for this key was written within this window. Autosave fires on
// every edit; this keeps restorable points without storing every keystroke.
const HISTORY_WINDOW_MINUTES = 10

export async function getDocText(sql: Sql, key: string): Promise<string | null> {
  const rows = await sql<{ data: string }[]>`select data::text as data from documents where key = ${key}`
  return rows[0]?.data ?? null
}

export async function getDoc<T>(sql: Sql, key: string): Promise<T | null> {
  const text = await getDocText(sql, key)
  return text === null ? null : (JSON.parse(text) as T)
}

export type PutResult = { ok: true; version: number } | { ok: false; currentVersion: number }

// Writes a document given as JSON text. Caller validated size/JSON.
// expectedVersion: the version the client's copy is based on (0 = "did not
// exist"). When it no longer matches, nothing is overwritten: the payload is
// parked in document_conflicts and the current version is returned.
// null skips the check (server-side writers, older clients).
export async function putDocText(
  sql: Sql,
  key: string,
  text: string,
  userId: string | null,
  expectedVersion: number | null = null,
): Promise<PutResult> {
  let result: PutResult = { ok: true, version: 0 }
  await inTransaction(sql, async (tx) => {
    const cur = await tx<{ version: number }[]>`select version from documents where key = ${key} for update`
    const currentVersion = cur[0]?.version ?? 0
    if (expectedVersion !== null && expectedVersion !== currentVersion) {
      await tx`
        insert into document_conflicts (key, based_on_version, current_version, data, user_id)
        values (${key}, ${expectedVersion}, ${currentVersion}, (${text}::text)::jsonb, ${userId})
      `
      result = { ok: false, currentVersion }
      return
    }
    await tx`
      insert into document_history (key, version, data, reason, changed_by)
      select d.key, d.version, d.data, 'edit', d.updated_by
      from documents d
      where d.key = ${key}
        and not exists (
          select 1 from document_history h
          where h.key = d.key and h.changed_at > now() - make_interval(mins => ${HISTORY_WINDOW_MINUTES})
        )
    `
    const [row] = await tx<{ version: number }[]>`
      insert into documents (key, data, updated_by)
      values (${key}, (${text}::text)::jsonb, ${userId})
      on conflict (key) do update
        set data = excluded.data,
            version = documents.version + 1,
            updated_at = now(),
            updated_by = excluded.updated_by
      returning version
    `
    result = { ok: true, version: row.version }
  })
  return result
}

export async function putDoc(sql: Sql, key: string, value: unknown, userId: string | null): Promise<void> {
  await putDocText(sql, key, JSON.stringify(value), userId)
}

// Reads a document together with its version (0 when it doesn't exist).
export async function getDocWithVersion(sql: Sql, key: string): Promise<{ text: string | null; version: number }> {
  const rows = await sql<{ data: string; version: number }[]>`
    select data::text as data, version from documents where key = ${key}
  `
  return { text: rows[0]?.data ?? null, version: rows[0]?.version ?? 0 }
}

export const VERSION_HEADER = 'x-doc-version'

// Parses the client's x-doc-version header; null when absent/invalid.
export function expectedVersionOf(request: Request): number | null {
  const v = request.headers.get(VERSION_HEADER)
  if (v === null || !/^\d{1,9}$/.test(v)) return null
  return Number(v)
}

export function putResponse(res: PutResult): Response {
  if (res.ok) {
    return new Response(JSON.stringify({ ok: true, version: res.version }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store', [VERSION_HEADER]: String(res.version) },
    })
  }
  return new Response(
    JSON.stringify({
      error: 'conflict',
      message: 'Diese Daten wurden inzwischen von jemand anderem geändert.',
      currentVersion: res.currentVersion,
    }),
    { status: 409, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  )
}

export async function deleteDoc(sql: Sql, key: string, userId: string | null): Promise<void> {
  await inTransaction(sql, async (tx) => {
    await tx`
      insert into document_history (key, version, data, reason, changed_by)
      select key, version, data, 'edit', ${userId} from documents where key = ${key}
    `
    await tx`delete from documents where key = ${key}`
  })
}

// Validates a PUT body: size cap + must parse as JSON. Returns the raw text.
export async function readDocBody(request: Request, maxBytes: number): Promise<string> {
  const body = await request.text()
  if (body.length > maxBytes) throw new HttpError(413, 'too large')
  try {
    JSON.parse(body)
  } catch {
    throw new HttpError(400, 'invalid json')
  }
  return body
}

export function docResponse(text: string | null, version?: number): Response {
  return new Response(text ?? 'null', {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...(version !== undefined ? { [VERSION_HEADER]: String(version) } : {}),
    },
  })
}

// Runs fn in a transaction, or directly when sql already is one.
async function inTransaction(sql: Sql, fn: (tx: Sql) => Promise<unknown>): Promise<void> {
  if (typeof (sql as { begin?: unknown }).begin === 'function') await sql.begin((tx) => fn(tx as unknown as Sql))
  else await fn(sql)
}
