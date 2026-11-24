import { currentUser } from '../../../server/auth'
import { handle, json } from '../../../server/http'
import type { Ctx } from '../../../server/routes'

// Current session (or null). Also returns accounts still waiting for a role,
// so the UI can show the "waiting for approval" screen.
export const onRequestGet = handle<Ctx>(async (ctx) => {
  return json({ user: await currentUser(ctx.data.sql, ctx.request) })
})
