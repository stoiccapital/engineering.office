import { consumeToken, createSession } from '../../../server/auth'
import { handle, error, json, readJson, str } from '../../../server/http'
import { loadUser, logLogin } from '../../../server/account'
import type { Ctx } from '../../../server/routes'

// Confirms the address from the emailed link and signs the user in.
export const onRequestPost = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const body = await readJson<{ token?: unknown }>(ctx.request)
  const tok = await consumeToken(sql, 'verify_email', str(body?.token, 200))
  if (!tok?.user_id) return error(400, 'invalid token', 'Der Link ist ungültig oder abgelaufen')
  await sql`update users set email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = ${tok.user_id}`
  const user = await loadUser(sql, tok.user_id)
  if (!user || user.status !== 'active') return error(403, 'disabled', 'Dieses Konto ist deaktiviert')
  const cookie = await createSession(sql, ctx.request, user.id)
  await logLogin(sql, user)
  return json({ user }, 200, { 'set-cookie': cookie })
})
