import { clearSessionCookie, destroySession } from '../../../server/auth'
import { handle, json } from '../../../server/http'
import type { Ctx } from '../../../server/routes'

export const onRequestPost = handle<Ctx>(async (ctx) => {
  await destroySession(ctx.data.sql, ctx.request)
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(ctx.request) })
})
