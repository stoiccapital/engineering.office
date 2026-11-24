import { docResponse, expectedVersionOf, getDocWithVersion, putDocText, putResponse, readDocBody } from '../../server/documents'
import { handle } from '../../server/http'
import { requireUser, type Ctx } from '../../server/routes'

const KEY = 'roster'

type RosterEmployee = { id: string; roleId?: string; password?: string; [k: string]: unknown }
type Roster = { employees?: RosterEmployee[]; [k: string]: unknown }

// Mitarbeiter directory. Logins now live in `users`; the roster no longer
// stores passwords (they were moved to legacy_logins, hashed, at import).
export const onRequestGet = handle<Ctx>(async (ctx) => {
  const { text, version } = await getDocWithVersion(ctx.data.sql, KEY)
  return docResponse(text, version)
})

export const onRequestPut = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const user = requireUser(ctx)
  const roster = JSON.parse(await readDocBody(ctx.request, 1_000_000)) as Roster | null

  if (roster && Array.isArray(roster.employees)) {
    // Never persist plaintext passwords again, even from an older client.
    roster.employees = roster.employees.map(({ password: _pw, ...rest }) => rest as RosterEmployee)
  }
  const res = await putDocText(sql, KEY, JSON.stringify(roster), user.id, expectedVersionOf(ctx.request))
  if (!res.ok) return putResponse(res)

  // The Mitarbeiter screen stays the place where admins set someone's role:
  // accounts linked to an employee follow that employee's roleId.
  if (roster && Array.isArray(roster.employees)) {
    const links = roster.employees
      .filter((e) => typeof e.id === 'string')
      .map((e) => ({ employee_id: e.id, role_id: typeof e.roleId === 'string' && e.roleId ? e.roleId : null }))
    if (links.length > 0) {
      await sql`
        update users u
        set role_id = case when exists (select 1 from roles r where r.id = l.role_id) then l.role_id else null end,
            updated_at = now()
        from jsonb_to_recordset(${sql.json(links as never)}::jsonb) as l(employee_id text, role_id text)
        where u.employee_id = l.employee_id
          and u.role_id is distinct from l.role_id
      `
    }
  }
  return putResponse(res)
})
