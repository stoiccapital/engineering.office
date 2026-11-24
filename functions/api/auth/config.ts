import { handle, json } from '../../../server/http'
import { mailConfigured } from '../../../server/email'
import type { Ctx } from '../../../server/routes'

// Public: which auth features this deployment offers (password reset needs a
// mail provider).
export const onRequestGet = handle<Ctx>(async (ctx) => {
  return json({ passwordReset: mailConfigured(ctx.env) })
})
