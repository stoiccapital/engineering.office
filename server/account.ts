import type { Sql } from './db'
import type { Env } from './env'
import { USER_SELECT, issueToken, toSessionUser, type SessionUser } from './auth'
import { appUrl, linkMail, sendMail } from './email'

export function verificationRequired(env: Env): boolean {
  return env.REQUIRE_EMAIL_VERIFICATION !== 'false'
}

export async function loadUser(sql: Sql, userId: string): Promise<SessionUser | null> {
  const rows = await sql.unsafe(
    `select ${USER_SELECT},
       (select e->>'kuerzel' from documents d,
          jsonb_array_elements(coalesce(d.data->'employees', '[]'::jsonb)) e
        where d.key = 'roster' and e->>'id' = u.employee_id limit 1) as kuerzel
     from users u left join roles r on r.id = u.role_id
     where u.id = $1`,
    [userId],
  )
  const row = rows[0] as unknown as (Parameters<typeof toSessionUser>[0] & { kuerzel: string | null }) | undefined
  return row ? toSessionUser(row, row.kuerzel || null) : null
}

export async function sendVerificationMail(env: Env, request: Request, sql: Sql, user: { id: string; email: string }) {
  const token = await issueToken(sql, 'verify_email', user.id, 60 * 48)
  await sendMail(
    env,
    linkMail({
      to: user.email,
      subject: 'E-Mail-Adresse bestätigen',
      intro: 'Bitte bestätige deine E-Mail-Adresse, um dein Konto für Engineering Office zu aktivieren.',
      cta: 'E-Mail bestätigen',
      link: `${appUrl(env, request)}/?verify=${encodeURIComponent(token)}`,
      outro: 'Der Link ist 48 Stunden gültig. Falls du kein Konto angelegt hast, kannst du diese E-Mail ignorieren.',
    }),
  )
}

export async function sendResetMail(env: Env, request: Request, sql: Sql, user: { id: string; email: string }) {
  const token = await issueToken(sql, 'reset_password', user.id, 60)
  await sendMail(
    env,
    linkMail({
      to: user.email,
      subject: 'Passwort zurücksetzen',
      intro: 'Du hast angefordert, dein Passwort für Engineering Office zurückzusetzen.',
      cta: 'Neues Passwort festlegen',
      link: `${appUrl(env, request)}/?reset=${encodeURIComponent(token)}`,
      outro: 'Der Link ist 60 Minuten gültig. Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.',
    }),
  )
}

export async function sendAccountExistsMail(env: Env, request: Request, email: string) {
  await sendMail(
    env,
    linkMail({
      to: email,
      subject: 'Du hast bereits ein Konto',
      intro: 'Jemand hat versucht, mit dieser E-Mail-Adresse ein neues Konto anzulegen. Es existiert bereits ein Konto.',
      cta: 'Zur Anmeldung',
      link: `${appUrl(env, request)}/`,
      outro: 'Passwort vergessen? Nutze auf der Anmeldeseite „Passwort vergessen“.',
    }),
  )
}

export async function logLogin(sql: Sql, user: SessionUser) {
  await sql`
    insert into activity_events (user_id, user_label, kind)
    values (${user.id}, ${(user.kuerzel || user.email).slice(0, 64)}, 'login')
  `
  await sql`update users set last_login_at = now() where id = ${user.id}`
}
