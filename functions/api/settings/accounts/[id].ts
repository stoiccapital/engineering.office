import { getDoc, putDoc } from '../../../../server/documents'
import { handle, error, json, readJson, str } from '../../../../server/http'
import { requireUser, type Ctx } from '../../../../server/routes'

type Employee = { id: string; roleId?: string; [k: string]: unknown }
type Roster = { employees?: Employee[]; [k: string]: unknown }

const UUID_RE = /^[0-9a-f-]{36}$/

// PATCH { roleId?, employeeId?, status?, displayName? }
// For accounts linked to a Mitarbeiter, the role lives on the employee
// (Mitarbeiter screen); changing it here writes it there too.
export const onRequestPatch = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const me = requireUser(ctx)
  const id = String(ctx.params.id)
  if (!UUID_RE.test(id)) return error(400, 'bad id')
  const body = await readJson<{ roleId?: unknown; employeeId?: unknown; status?: unknown; displayName?: unknown }>(ctx.request)

  const [target] = await sql<{ id: string; role_id: string | null; employee_id: string | null; status: string }[]>`
    select id, role_id, employee_id, status from users where id = ${id}
  `
  if (!target) return error(404, 'not found')

  let roleId = target.role_id
  let employeeId = target.employee_id
  let status = target.status
  let rosterChanged = false
  const roster = (await getDoc<Roster>(sql, 'roster')) ?? null

  if ('status' in body) {
    if (body.status !== 'active' && body.status !== 'disabled') return error(400, 'bad status')
    if (id === me.id && body.status === 'disabled') return error(409, 'self', 'Du kannst dein eigenes Konto nicht deaktivieren')
    status = body.status
  }

  if ('employeeId' in body) {
    const next = body.employeeId === null || body.employeeId === '' ? null : str(body.employeeId, 100)
    if (next) {
      const emp = roster?.employees?.find((e) => e.id === next)
      if (!emp) return error(400, 'unknown employee')
      const other = await sql`select 1 from users where employee_id = ${next} and id <> ${id}`
      if (other.length) return error(409, 'employee linked', 'Dieser Mitarbeiter ist bereits mit einem anderen Konto verknüpft')
      if (emp.roleId) roleId = emp.roleId
      else if (roleId) {
        emp.roleId = roleId
        rosterChanged = true
      }
    }
    employeeId = next
  }

  if ('roleId' in body) {
    const next = body.roleId === null || body.roleId === '' ? null : str(body.roleId, 100)
    if (next) {
      const exists = await sql`select 1 from roles where id = ${next}`
      if (!exists.length) return error(400, 'unknown role')
    }
    roleId = next
    if (employeeId) {
      const emp = roster?.employees?.find((e) => e.id === employeeId)
      if (emp) {
        if (next) emp.roleId = next
        else delete emp.roleId
        rosterChanged = true
      }
    }
  }

  if (id === me.id) {
    const [{ ok }] = await sql<{ ok: boolean }[]>`
      select coalesce((select 'settings' = any(modules) from roles where id = ${roleId}), false) as ok
    `
    if (!ok) return error(409, 'self', 'Du kannst dir selbst nicht die Einstellungen-Rechte entziehen')
  }

  const displayName = 'displayName' in body ? str(body.displayName, 100) : null
  await sql.begin(async (tx) => {
    if (rosterChanged && roster) await putDoc(tx as never, 'roster', roster, me.id)
    await tx`
      update users set role_id = ${roleId}, employee_id = ${employeeId}, status = ${status},
        display_name = coalesce(${displayName}, display_name), updated_at = now()
      where id = ${id}
    `
    if (status === 'disabled') await tx`delete from sessions where user_id = ${id}`
  })
  return json({ ok: true })
})

export const onRequestDelete = handle<Ctx>(async (ctx) => {
  const me = requireUser(ctx)
  const id = String(ctx.params.id)
  if (!UUID_RE.test(id)) return error(400, 'bad id')
  if (id === me.id) return error(409, 'self', 'Du kannst dein eigenes Konto nicht löschen')
  // A legacy login this account had claimed becomes usable again.
  await ctx.data.sql`delete from users where id = ${id}`
  return json({ ok: true })
})
