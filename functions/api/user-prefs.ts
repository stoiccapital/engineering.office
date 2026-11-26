import type { Ctx } from '../../server/routes'
import { requireUser } from '../../server/routes'
import { handle, error } from '../../server/http'
import {
  docResponse,
  expectedVersionOf,
  getDocWithVersion,
  putDocText,
  putResponse,
  readDocBody,
} from '../../server/documents'

// Per-user preferences doc — theme (dark/light) + accent color. Scoped by
// authenticated user id so one user can't read or clobber another's prefs.
// Keyed in the shared `documents` table as `user_prefs:{userId}`.

const MAX_BYTES = 10_000

function keyFor(userId: string): string {
  return `user_prefs:${userId}`
}

export const onRequestGet = handle<Ctx>(async (ctx) => {
  const user = requireUser(ctx)
  const { text, version } = await getDocWithVersion(ctx.data.sql, keyFor(user.id))
  return docResponse(text, version)
})

export const onRequestPut = handle<Ctx>(async (ctx) => {
  const user = requireUser(ctx)
  if (!user.id) return error(400, 'missing user id')
  const text = await readDocBody(ctx.request, MAX_BYTES)
  const res = await putDocText(
    ctx.data.sql,
    keyFor(user.id),
    text,
    user.id,
    expectedVersionOf(ctx.request),
  )
  return putResponse(res)
})
