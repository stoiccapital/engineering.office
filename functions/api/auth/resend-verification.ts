import { normalizeEmail } from '../../../server/auth'
import { handle, error, json, readJson } from '../../../server/http'
import { sendVerificationMail } from '../../../server/account'
import type { Ctx } from '../../../server/routes'

export const onRequestPost = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const body = await readJson<{ email?: unknown }>(ctx.request)
  const email = normalizeEmail(body?.email)
  if (!email) return error(400, 'invalid email')
  const rows = await sql<{ id: string }[]>`
    select id from users where email = ${email} and email_verified_at is null and status = 'active'
  `
  // Throttle: at most one verification mail per address every 2 minutes.
  if (rows[0]) {
    const recent = await sql`
      select 1 from auth_tokens where user_id = ${rows[0].id} and purpose = 'verify_email'
        and created_at > now() - interval '2 minutes'
    `
    if (recent.length === 0) {
      try {
        await sendVerificationMail(ctx.env, ctx.request, sql, { id: rows[0].id, email })
      } catch (e) {
        console.error('[resend] mail failed', e)
        return error(502, 'mail failed', 'Die E-Mail konnte nicht gesendet werden')
      }
    }
  }
  return json({ ok: true })
})
