import { consumeToken, createSession, passwordProblem } from '../../../server/auth'
import { hashPassword } from '../../../server/crypto'
import { handle, error, json, readJson, str } from '../../../server/http'
import { loadUser, logLogin } from '../../../server/account'
import type { Ctx } from '../../../server/routes'

export const onRequestPost = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const body = await readJson<{ token?: unknown; password?: unknown }>(ctx.request)
  const pwProblem = passwordProblem(body?.password)
  if (pwProblem) return error(400, 'weak password', pwProblem)
  const tok = await consumeToken(sql, 'reset_password', str(body?.token, 200))
  if (!tok?.user_id) return error(400, 'invalid token', 'Der Link ist ungültig oder abgelaufen')

  const hash = await hashPassword(body!.password as string)
  // The link proves ownership of the address, so this also verifies it.
  // All existing sessions are revoked.
  await sql.begin(async (tx) => {
    await tx`
      update users set password_hash = ${hash}, failed_login_count = 0, locked_until = null,
        email_verified_at = coalesce(email_verified_at, now()), updated_at = now()
      where id = ${tok.user_id}
    `
    await tx`delete from sessions where user_id = ${tok.user_id}`
    await tx`update auth_tokens set used_at = now() where user_id = ${tok.user_id} and purpose = 'reset_password' and used_at is null`
  })
  const user = await loadUser(sql, tok.user_id)
  if (!user || user.status !== 'active') return error(403, 'disabled', 'Dieses Konto ist deaktiviert')
  const cookie = await createSession(sql, ctx.request, user.id)
  await logLogin(sql, user)
  return json({ user }, 200, { 'set-cookie': cookie })
})
