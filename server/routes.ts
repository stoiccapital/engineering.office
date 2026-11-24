import type { Env } from './env'
import type { Sql } from './db'
import type { SessionUser } from './auth'
import { handle, error } from './http'
import { docResponse, expectedVersionOf, getDocWithVersion, putDocText, putResponse, readDocBody } from './documents'

// Per-request data filled in by functions/_middleware.ts.
export type Data = { sql: Sql; user?: SessionUser }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ctx = EventContext<Env, any, Data>

export function requireUser(ctx: Ctx): SessionUser {
  const u = ctx.data.user
  if (!u) throw new Error('route reached without an authenticated user')
  return u
}

// GET/PUT pair for a module document. `key` maps route params to the storage
// key (the old KV key) or null when the params are invalid.
export function documentRoutes(opts: { key: (params: Record<string, string>) => string | null; maxBytes: number }) {
  const resolve = (ctx: Ctx) => opts.key(ctx.params as Record<string, string>)
  return {
    onRequestGet: handle<Ctx>(async (ctx) => {
      const key = resolve(ctx)
      if (!key) return error(400, 'bad key')
      const { text, version } = await getDocWithVersion(ctx.data.sql, key)
      return docResponse(text, version)
    }),
    onRequestPut: handle<Ctx>(async (ctx) => {
      const key = resolve(ctx)
      if (!key) return error(400, 'bad key')
      const text = await readDocBody(ctx.request, opts.maxBytes)
      const res = await putDocText(ctx.data.sql, key, text, requireUser(ctx).id, expectedVersionOf(ctx.request))
      return putResponse(res)
    }),
  }
}
