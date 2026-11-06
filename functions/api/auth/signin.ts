interface Env {
  FORECAST_KV: KVNamespace
}

type Role = { id: string; name: string; password: string; modules: string[] }
type User = {
  id: string
  vorname: string
  name: string
  kuerzel: string
  personalnummer: string
  password: string
  roleId: string
}
type AccessConfig = { roles: Role[]; users?: User[] }

const KEY = 'settings:access'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: { roleId?: string; password?: string; kuerzel?: string }
  try {
    body = (await request.json()) as {
      roleId?: string
      password?: string
      kuerzel?: string
    }
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const { roleId, password, kuerzel } = body
  if (typeof password !== 'string' || (!roleId && !kuerzel)) {
    return json({ error: 'missing credentials' }, 400)
  }
  const raw = await env.FORECAST_KV.get(KEY)
  const cfg = raw ? (JSON.parse(raw) as AccessConfig) : null

  if (kuerzel) {
    const user = cfg?.users?.find((u) => u.kuerzel === kuerzel)
    if (!user || user.password !== password) {
      return json({ error: 'invalid credentials' }, 401)
    }
    const role = cfg?.roles.find((r) => r.id === user.roleId)
    if (!role) return json({ error: 'role missing for user' }, 401)
    const displayName =
      [user.vorname, user.name].filter((s) => s.trim().length > 0).join(' ') || user.kuerzel
    return json({
      ok: true,
      role: { id: role.id, name: role.name, modules: role.modules },
      user: { id: user.id, kuerzel: user.kuerzel, displayName },
    })
  }

  const role = cfg?.roles.find((r) => r.id === roleId)
  if (!role || role.password !== password) {
    return json({ error: 'invalid credentials' }, 401)
  }
  return json({ ok: true, role: { id: role.id, name: role.name, modules: role.modules } })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
