import { consumeToken, createSession, normalizeEmail, passwordProblem } from '../../../server/auth'
import { hashPassword } from '../../../server/crypto'
import { getDoc } from '../../../server/documents'
import { handle, error, json, readJson, str } from '../../../server/http'
import { loadUser, logLogin, sendVerificationMail, verificationRequired } from '../../../server/account'
import type { Ctx } from '../../../server/routes'

type Roster = { employees?: { id: string; roleId?: string }[] }

// Creates the email account for a verified legacy login (see legacy-login.ts).
// The person proved who they are with the old password, so they are signed
// in right away; the email address still gets a confirmation link, which is
// required for later sign-ins.
export const onRequestPost = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const body = await readJson<{ claimToken?: unknown; email?: unknown; password?: unknown; displayName?: unknown }>(ctx.request)
  const email = normalizeEmail(body?.email)
  if (!email) return error(400, 'invalid email', 'Bitte eine gültige E-Mail-Adresse eingeben')
  const pwProblem = passwordProblem(body?.password)
  if (pwProblem) return error(400, 'weak password', pwProblem)
  const displayName = str(body?.displayName, 100)

  const taken = await sql`select 1 from users where email = ${email}`
  if (taken.length) return error(409, 'email taken', 'Für diese E-Mail-Adresse gibt es bereits ein Konto')

  const tok = await consumeToken(sql, 'claim_legacy', str(body?.claimToken, 200))
  if (!tok) return error(400, 'invalid token', 'Sitzung abgelaufen. Bitte erneut mit Kürzel anmelden.')
  const passwordHash = await hashPassword(body!.password as string)

  const result = await sql.begin(async (tx) => {
    let roleId: string | null = null
    let employeeId: string | null = null
    let legacyId: string | null = null

    if (typeof tok.payload.legacyId === 'string') {
      const [l] = await tx<{ id: string; kuerzel: string; employee_id: string | null; role_id: string | null; claimed: boolean }[]>`
        select id::text as id, kuerzel, employee_id, role_id, claimed_by_user_id is not null as claimed
        from legacy_logins where id = ${tok.payload.legacyId}::bigint for update
      `
      if (!l || l.claimed) return null
      legacyId = l.id
      roleId = l.role_id
      if (l.employee_id) {
        const linked = await tx`select 1 from users where employee_id = ${l.employee_id}`
        if (!linked.length) employeeId = l.employee_id
        // The Mitarbeiter screen is the source of truth for the role.
        const roster = await getDoc<Roster>(tx as never, 'roster')
        const emp = roster?.employees?.find((e) => e.id === l.employee_id)
        if (emp?.roleId) roleId = emp.roleId
      }
    } else if (typeof tok.payload.roleId === 'string') {
      roleId = tok.payload.roleId
    }
    if (roleId) {
      const exists = await tx`select 1 from roles where id = ${roleId}`
      if (!exists.length) roleId = null
    }

    const [user] = await tx<{ id: string }[]>`
      insert into users (email, password_hash, display_name, role_id, employee_id)
      values (${email}, ${passwordHash}, ${displayName}, ${roleId}, ${employeeId})
      returning id
    `
    if (legacyId) {
      await tx`update legacy_logins set claimed_by_user_id = ${user.id}, claimed_at = now() where id = ${legacyId}::bigint`
    }
    return { id: user.id }
  })
  if (!result) return error(409, 'already claimed', 'Dieser Zugang ist bereits mit einer E-Mail verknüpft')

  if (verificationRequired(ctx.env)) {
    try {
      await sendVerificationMail(ctx.env, ctx.request, sql, { id: result.id, email })
    } catch (e) {
      // Not fatal: the user is signed in and can request a new link later.
      console.error('[claim] mail failed', e)
    }
  }
  const cookie = await createSession(sql, ctx.request, result.id)
  const user = await loadUser(sql, result.id)
  if (user) await logLogin(sql, user)
  return json({ user }, 200, { 'set-cookie': cookie })
})
