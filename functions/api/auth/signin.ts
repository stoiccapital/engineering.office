interface Env {
  FORECAST_KV: KVNamespace
}

type Role = { id: string; name: string; password: string; modules: string[] }
type AccessConfig = { roles: Role[] }

const KEY = 'settings:access'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: { roleId?: string; password?: string }
  try {
    body = (await request.json()) as { roleId?: string; password?: string }
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const { roleId, password } = body
  if (!roleId || typeof password !== 'string') {
    return json({ error: 'missing credentials' }, 400)
  }
  const raw = await env.FORECAST_KV.get(KEY)
  const cfg = raw ? (JSON.parse(raw) as AccessConfig) : null
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
