import { pgTextArray } from '../../../server/db'
import { handle, error, json, readJson } from '../../../server/http'
import { requireUser, type Ctx } from '../../../server/routes'

// Role management for the Rollen screen. Keeps the old AccessConfig shape
// ({ roles, users }) so the existing UI works; `users` is always empty now —
// accounts are managed through /api/settings/accounts.

type RoleIn = { id?: unknown; name?: unknown; modules?: unknown }

export const onRequestGet = handle<Ctx>(async (ctx) => {
  const roles = await ctx.data.sql<{ id: string; name: string; modules: string[] }[]>`
    select id, name, to_jsonb(modules) as modules from roles order by sort_order, created_at
  `
  return json({ roles: roles.map((r) => ({ ...r, password: '' })), users: [] })
})

export const onRequestPut = handle<Ctx>(async (ctx) => {
  const sql = ctx.data.sql
  const me = requireUser(ctx)
  const body = await readJson<{ roles?: RoleIn[] }>(ctx.request, 100_000)
  if (!body || !Array.isArray(body.roles)) return error(400, 'roles required')

  const roles = body.roles.map((r, i) => ({
    id: typeof r.id === 'string' ? r.id.slice(0, 100) : '',
    name: typeof r.name === 'string' ? r.name.slice(0, 100) : '',
    modules: Array.isArray(r.modules) ? r.modules.filter((m): m is string => typeof m === 'string').slice(0, 100) : [],
    sort_order: i,
  }))
  if (roles.some((r) => !r.id)) return error(400, 'role id required')
  if (new Set(roles.map((r) => r.id)).size !== roles.length) return error(400, 'duplicate role id')

  // Don't let an admin lock everyone (including themselves) out of Settings.
  const myRole = roles.find((r) => r.id === me.role?.id)
  if (!myRole || !myRole.modules.includes('settings')) {
    const [{ admins }] = await sql<{ admins: number }[]>`
      select count(*)::int as admins from users u
      where u.status = 'active' and u.id <> ${me.id} and u.role_id = any(${pgTextArray(roles.filter((r) => r.modules.includes('settings')).map((r) => r.id))}::text[])
    `
    if (admins === 0) return error(409, 'last admin', 'Mindestens ein aktives Konto muss die Einstellungen verwalten können')
  }

  await sql.begin(async (tx) => {
    await tx`delete from roles where id <> all(${pgTextArray(roles.map((r) => r.id))}::text[])`
    for (const r of roles) {
      await tx`
        insert into roles (id, name, modules, sort_order)
        values (${r.id}, ${r.name}, ${pgTextArray(r.modules)}::text[], ${r.sort_order})
        on conflict (id) do update
          set name = excluded.name, modules = excluded.modules,
              sort_order = excluded.sort_order, updated_at = now()
      `
    }
  })
  return json({ ok: true })
})
