import { getDoc } from '../../../../server/documents'
import { handle, json } from '../../../../server/http'
import type { Ctx } from '../../../../server/routes'

type Roster = { employees?: { id: string; vorname?: string; name?: string; kuerzel?: string; roleId?: string }[] }

// Admin list of email accounts plus the roster employees they can be linked to.
export const onRequestGet = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const rows = await sql<
    {
      id: string
      email: string
      display_name: string
      email_verified_at: Date | null
      status: string
      role_id: string | null
      employee_id: string | null
      created_at: Date
      last_login_at: Date | null
    }[]
  >`
    select id, email::text as email, display_name, email_verified_at, status, role_id, employee_id,
           created_at, last_login_at
    from users order by created_at
  `
  const roster = await getDoc<Roster>(sql, 'roster')
  const legacy = await sql<{ kuerzel: string; display_name: string; claimed: boolean }[]>`
    select kuerzel, display_name, claimed_by_user_id is not null as claimed from legacy_logins order by kuerzel
  `
  return json({
    accounts: rows.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      emailVerified: r.email_verified_at !== null,
      status: r.status,
      roleId: r.role_id,
      employeeId: r.employee_id,
      createdAt: new Date(r.created_at).toISOString(),
      lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
    })),
    employees: (roster?.employees ?? []).map((e) => ({
      id: e.id,
      label: [e.vorname, e.name].filter((s) => s && s.trim()).join(' ') || e.kuerzel || e.id,
      kuerzel: e.kuerzel ?? null,
      roleId: e.roleId ?? null,
    })),
    // Old Kürzel logins that nobody has turned into an email account yet.
    pendingLegacy: legacy.filter((l) => !l.claimed).map((l) => ({ kuerzel: l.kuerzel, displayName: l.display_name })),
  })
})
