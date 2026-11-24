import { issueToken } from '../../../server/auth'
import { burnPasswordCheck, verifyPassword } from '../../../server/crypto'
import { handle, error, json, readJson, str } from '../../../server/http'
import type { Ctx } from '../../../server/routes'
import { THROTTLE_LOCK_MINUTES, clearFailures, clientIp, isLocked, recordFailure } from '../../../server/throttle'

// One-time bridge for people who signed in with Kürzel + password (or a
// shared role password) before email accounts existed. A correct password
// returns a short-lived claim token; /api/auth/claim then turns it into an
// email account with the same role and Mitarbeiter link.
export const onRequestPost = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const body = await readJson<{ kuerzel?: unknown; password?: unknown }>(ctx.request)
  const login = str(body?.kuerzel, 100)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!login || !password) return error(400, 'missing credentials')

  const ip = clientIp(ctx.request)
  const loginKey = `legacy:${login.toLowerCase()}`
  const keys = ip ? [loginKey, `legacy-ip:${ip}`] : [loginKey]
  if (await isLocked(sql, keys)) {
    return error(429, 'locked', `Zu viele Fehlversuche. Bitte in ${THROTTLE_LOCK_MINUTES} Minuten erneut versuchen.`)
  }
  const denied = async () => {
    await recordFailure(sql, keys)
    return error(401, 'invalid credentials', 'Kürzel oder Passwort falsch')
  }

  const legacy = await sql<{ id: string; kuerzel: string; password_hash: string; display_name: string; claimed: boolean }[]>`
    select id::text as id, kuerzel, password_hash, display_name, claimed_by_user_id is not null as claimed
    from legacy_logins where kuerzel = ${login} order by claimed_by_user_id nulls first, id
  `
  if (legacy.length) {
    // Kürzel may be shared by several old entries; the password decides.
    let l: (typeof legacy)[number] | undefined
    for (const cand of legacy) {
      if (await verifyPassword(password, cand.password_hash)) {
        l = cand
        break
      }
    }
    if (!l) return denied()
    await clearFailures(sql, [loginKey])
    if (l.claimed) {
      return error(409, 'already claimed', 'Dieser Zugang ist bereits mit einer E-Mail verknüpft. Bitte mit E-Mail anmelden.')
    }
    const claimToken = await issueToken(sql, 'claim_legacy', null, 30, { legacyId: l.id })
    return json({ claimToken, displayName: l.display_name, kuerzel: l.kuerzel })
  }

  // Shared role password (from the very first setup, before personal logins).
  const roles = await sql<{ id: string; name: string; legacy_password_hash: string }[]>`
    select id, name, legacy_password_hash from roles
    where lower(name) = lower(${login}) and legacy_password_hash is not null
  `
  for (const r of roles) {
    if (await verifyPassword(password, r.legacy_password_hash)) {
      await clearFailures(sql, [loginKey])
      const claimToken = await issueToken(sql, 'claim_legacy', null, 30, { roleId: r.id })
      return json({ claimToken, displayName: '', kuerzel: null, roleName: r.name })
    }
  }
  if (roles.length === 0) await burnPasswordCheck(password)
  return denied()
})
