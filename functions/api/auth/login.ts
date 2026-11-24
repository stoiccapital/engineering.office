import { createSession, normalizeEmail } from '../../../server/auth'
import { burnPasswordCheck, verifyPassword } from '../../../server/crypto'
import { handle, error, json, readJson } from '../../../server/http'
import { loadUser, logLogin, verificationRequired } from '../../../server/account'
import type { Ctx } from '../../../server/routes'

const MAX_FAILURES = 10
const LOCK_MINUTES = 15

export const onRequestPost = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const body = await readJson<{ email?: unknown; password?: unknown }>(ctx.request)
  const email = normalizeEmail(body?.email)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) return error(400, 'missing credentials')

  const rows = await sql<
    { id: string; password_hash: string; status: string; email_verified_at: Date | null; locked: boolean }[]
  >`
    select id, password_hash, status, email_verified_at, coalesce(locked_until > now(), false) as locked
    from users where email = ${email}
  `
  const row = rows[0]
  if (!row) {
    await burnPasswordCheck(password)
    return error(401, 'invalid credentials', 'E-Mail oder Passwort falsch')
  }
  if (row.locked) return error(429, 'locked', `Zu viele Fehlversuche. Bitte in ${LOCK_MINUTES} Minuten erneut versuchen.`)

  if (!(await verifyPassword(password, row.password_hash))) {
    await sql`
      update users set
        failed_login_count = case when failed_login_count + 1 >= ${MAX_FAILURES} then 0 else failed_login_count + 1 end,
        locked_until = case when failed_login_count + 1 >= ${MAX_FAILURES}
                            then now() + make_interval(mins => ${LOCK_MINUTES}) else locked_until end
      where id = ${row.id}
    `
    return error(401, 'invalid credentials', 'E-Mail oder Passwort falsch')
  }
  await sql`update users set failed_login_count = 0, locked_until = null where id = ${row.id}`

  if (row.status !== 'active') return error(403, 'disabled', 'Dieses Konto ist deaktiviert')
  if (verificationRequired(ctx.env) && !row.email_verified_at) {
    return error(403, 'email_unverified', 'Bitte bestätige zuerst deine E-Mail-Adresse')
  }

  const cookie = await createSession(sql, ctx.request, row.id)
  const user = await loadUser(sql, row.id)
  if (user) await logLogin(sql, user)
  return json({ user }, 200, { 'set-cookie': cookie })
})
