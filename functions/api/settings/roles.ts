interface Env {
  FORECAST_KV: KVNamespace
}

type Role = { id: string; name: string; password: string; modules: string[] }
type AccessConfig = { roles: Role[] }

const KEY = 'settings:access'

// Public: returns only role id + name so the login screen can show a dropdown.
// Does not expose passwords or module matrices.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.FORECAST_KV.get(KEY)
  const cfg = raw ? (JSON.parse(raw) as AccessConfig) : null
  const roles = (cfg?.roles ?? []).map((r) => ({ id: r.id, name: r.name }))
  return new Response(JSON.stringify(roles), {
    headers: { 'content-type': 'application/json' },
  })
}
