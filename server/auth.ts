import type { Sql } from './db'
import { randomToken, sha256Hex } from './crypto'

export const SESSION_COOKIE = 'eo_session'
const SESSION_DAYS = 30

export const ALL_MODULES = [
  'ziele_dashboard', 'ziele_teams', 'ziele_kontrolle', 'dashboard', 'forecast', 'plan',
  'plan_overview', 'rechnungen', 'projektliste', 'ks_bauwerke', 'ks_hoai', 'ks_katalog',
  'ke_positionen', 'ke_uebersicht', 'ke_datenbank', 'hr_zeiterfassung', 'hr_gespraeche',
  'hr_team_view', 'mitarbeiter', 'settings',
]

export type SessionUser = {
  id: string
  email: string
  displayName: string
  emailVerified: boolean
  status: 'active' | 'disabled'
  employeeId: string | null
  kuerzel: string | null
  role: { id: string; name: string; modules: string[] } | null
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

function cookieAttrs(request: Request, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export async function createSession(sql: Sql, request: Request, userId: string): Promise<string> {
  const token = randomToken()
  const id = await sha256Hex(token)
  const ua = (request.headers.get('user-agent') ?? '').slice(0, 300)
  await sql`
    insert into sessions (id, user_id, expires_at, user_agent)
    values (${id}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}), ${ua})
  `
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttrs(request, SESSION_DAYS * 86400)}`
}

export function clearSessionCookie(request: Request): string {
  return `${SESSION_COOKIE}=; ${cookieAttrs(request, 0)}`
}

export async function destroySession(sql: Sql, request: Request): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return
  await sql`delete from sessions where id = ${await sha256Hex(token)}`
}

type UserRow = {
  id: string
  email: string
  display_name: string
  email_verified_at: Date | null
  status: 'active' | 'disabled'
  employee_id: string | null
  role_id: string | null
  role_name: string | null
  role_modules: string[] | null
}

export function toSessionUser(row: UserRow, kuerzel: string | null = null): SessionUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email,
    emailVerified: row.email_verified_at !== null,
    status: row.status,
    employeeId: row.employee_id,
    kuerzel,
    role: row.role_id && row.role_name !== null
      ? { id: row.role_id, name: row.role_name, modules: row.role_modules ?? [] }
      : null,
  }
}

export const USER_SELECT = `
  u.id, u.email::text as email, u.display_name, u.email_verified_at, u.status,
  u.employee_id, u.role_id, r.name as role_name, to_jsonb(r.modules) as role_modules
`

// Resolves the session cookie to a user (with role). Slides last_seen_at.
export async function currentUser(sql: Sql, request: Request): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  const id = await sha256Hex(token)
  const rows = await sql.unsafe<(UserRow & { kuerzel: string | null })[]>(
    `select ${USER_SELECT},
       (select e->>'kuerzel' from documents d,
          jsonb_array_elements(coalesce(d.data->'employees', '[]'::jsonb)) e
        where d.key = 'roster' and e->>'id' = u.employee_id limit 1) as kuerzel
     from sessions s
     join users u on u.id = s.user_id
     left join roles r on r.id = u.role_id
     where s.id = $1 and s.expires_at > now()`,
    [id],
  )
  const row = rows[0]
  if (!row || row.status !== 'active') return null
  // Cheap write at most once per 10 minutes per session.
  await sql`update sessions set last_seen_at = now() where id = ${id} and last_seen_at < now() - interval '10 minutes'`
  return toSessionUser(row, row.kuerzel || null)
}

// Label used in the activity log and "updated by" displays.
export function userLabel(u: SessionUser): string {
  return u.kuerzel || u.email
}

export async function issueToken(
  sql: Sql,
  purpose: 'verify_email' | 'reset_password' | 'claim_legacy',
  userId: string | null,
  ttlMinutes: number,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const token = randomToken()
  await sql`
    insert into auth_tokens (token_hash, purpose, user_id, payload, expires_at)
    values (${await sha256Hex(token)}, ${purpose}, ${userId}, ${sql.json(payload as never)},
            now() + make_interval(mins => ${ttlMinutes}))
  `
  return token
}

// Marks a token used and returns it, or null if unknown / expired / used.
export async function consumeToken(
  sql: Sql,
  purpose: string,
  token: string,
): Promise<{ user_id: string | null; payload: Record<string, unknown> } | null> {
  if (!token) return null
  const rows = await sql<{ user_id: string | null; payload: Record<string, unknown> }[]>`
    update auth_tokens set used_at = now()
    where token_hash = ${await sha256Hex(token)} and purpose = ${purpose}
      and used_at is null and expires_at > now()
    returning user_id, payload
  `
  return rows[0] ?? null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const e = v.trim().toLowerCase()
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null
}

export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'Passwort muss mindestens 8 Zeichen haben'
  if (pw.length > 200) return 'Passwort ist zu lang'
  return null
}
