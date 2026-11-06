interface Env {
  FORECAST_KV: KVNamespace
}

type User = {
  id: string
  vorname: string
  name: string
  kuerzel: string
  personalnummer: string
  password: string
  roleId: string
}
type AccessConfig = { roles: unknown[]; users?: User[] }

const KEY = 'settings:access'

// Public: returns only id, kuerzel, and display name so the login screen can
// show a user dropdown. Never leaks passwords or personalnummer.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.FORECAST_KV.get(KEY)
  const cfg = raw ? (JSON.parse(raw) as AccessConfig) : null
  const users = (cfg?.users ?? []).map((u) => ({
    id: u.id,
    kuerzel: u.kuerzel,
    displayName:
      [u.vorname, u.name].filter((s) => s.trim().length > 0).join(' ') || u.kuerzel,
  }))
  return new Response(JSON.stringify(users), {
    headers: { 'content-type': 'application/json' },
  })
}
