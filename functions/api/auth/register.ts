import { ALL_MODULES, normalizeEmail, passwordProblem } from '../../../server/auth'
import { hashPassword } from '../../../server/crypto'
import { pgTextArray } from '../../../server/db'
import { handle, error, json, readJson, str } from '../../../server/http'
import { sendAccountExistsMail, sendVerificationMail, verificationRequired } from '../../../server/account'
import type { Ctx } from '../../../server/routes'

// Self-service sign-up with any email address. New accounts have no role
// until an admin assigns one — except on a completely empty installation,
// where the first account becomes the admin.
export const onRequestPost = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const body = await readJson<{ email?: unknown; password?: unknown; displayName?: unknown }>(ctx.request)
  const email = normalizeEmail(body?.email)
  if (!email) return error(400, 'invalid email', 'Bitte eine gültige E-Mail-Adresse eingeben')
  const pwProblem = passwordProblem(body?.password)
  if (pwProblem) return error(400, 'weak password', pwProblem)
  const displayName = str(body?.displayName, 100)
  const passwordHash = await hashPassword(body!.password as string)

  const result = await sql.begin(async (tx) => {
    // Serialise sign-ups so two "first" accounts can't both become admin.
    await tx`select pg_advisory_xact_lock(4711)`
    const existing = await tx<{ id: string; email_verified_at: Date | null }[]>`
      select id, email_verified_at from users where email = ${email}
    `
    if (existing[0]) return { kind: 'exists' as const, ...existing[0] }

    const [{ users, roles }] = await tx<{ users: number; roles: number }[]>`
      select (select count(*)::int from users) as users, (select count(*)::int from roles) as roles
    `
    let roleId: string | null = null
    if (users === 0 && roles === 0) {
      roleId = 'admin'
      await tx`insert into roles (id, name, modules) values ('admin', 'Admin', ${pgTextArray(ALL_MODULES)}::text[])`
    }
    const [user] = await tx<{ id: string }[]>`
      insert into users (email, password_hash, display_name, role_id)
      values (${email}, ${passwordHash}, ${displayName}, ${roleId})
      returning id
    `
    return { kind: 'created' as const, id: user.id, bootstrapAdmin: roleId !== null }
  })

  try {
    if (result.kind === 'exists') {
      // Same response either way, so the form can't be used to probe emails.
      if (!result.email_verified_at) await sendVerificationMail(ctx.env, ctx.request, sql, { id: result.id, email })
      else await sendAccountExistsMail(ctx.env, ctx.request, email)
    } else if (verificationRequired(ctx.env)) {
      await sendVerificationMail(ctx.env, ctx.request, sql, { id: result.id, email })
    }
  } catch (e) {
    console.error('[register] mail failed', e)
    return error(502, 'mail failed', 'Die E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen.')
  }
  return json({ ok: true, verificationRequired: verificationRequired(ctx.env) })
})
