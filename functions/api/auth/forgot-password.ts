import { normalizeEmail } from '../../../server/auth'
import { handle, error, json, readJson } from '../../../server/http'
import { sendResetMail } from '../../../server/account'
import type { Ctx } from '../../../server/routes'

// Always answers ok so the form doesn't reveal which emails have accounts.
export const onRequestPost = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const body = await readJson<{ email?: unknown }>(ctx.request)
  const email = normalizeEmail(body?.email)
  if (!email) return error(400, 'invalid email', 'Bitte eine gültige E-Mail-Adresse eingeben')
  const rows = await sql<{ id: string }[]>`select id from users where email = ${email} and status = 'active'`
  if (rows[0]) {
    const recent = await sql`
      select 1 from auth_tokens where user_id = ${rows[0].id} and purpose = 'reset_password'
        and created_at > now() - interval '2 minutes'
    `
    if (recent.length === 0) {
      try {
        await sendResetMail(ctx.env, ctx.request, sql, { id: rows[0].id, email })
      } catch (e) {
        console.error('[forgot] mail failed', e)
        return error(502, 'mail failed', 'Die E-Mail konnte nicht gesendet werden')
      }
    }
  }
  return json({ ok: true })
})
