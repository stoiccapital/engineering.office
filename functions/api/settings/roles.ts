import { handle, json } from '../../../server/http'
import type { Ctx } from '../../../server/routes'

// Role id + name for pickers. Requires a signed-in user (no longer public).
export const onRequestGet = handle<Ctx>(async (ctx) => {
  const roles = await ctx.data.sql<{ id: string; name: string }[]>`
    select id, name from roles order by sort_order, created_at
  `
  return json(roles)
})
