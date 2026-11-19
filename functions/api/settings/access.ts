import { hashPassword, isHashed } from '../../_lib/password'

interface Env {
  FORECAST_KV: KVNamespace
}

type Role = { id: string; name: string; password: string; modules: string[] }
type User = { id: string; kuerzel: string; password: string; roleId: string }
type AccessConfig = { roles: Role[]; users?: User[] }

const KEY = 'settings:access'
const MAX_LEN = 100_000

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.FORECAST_KV.get(KEY)
  return json(raw ? JSON.parse(raw) : null)
}

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const text = await request.text()
  if (text.length > MAX_LEN) return json({ error: 'too large' }, 413)
  let cfg: AccessConfig
  try {
    cfg = JSON.parse(text) as AccessConfig
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  // Hash any plaintext passwords before persisting. Existing hashed passwords
  // pass through untouched.
  for (const r of cfg.roles ?? []) {
    if (r.password && !isHashed(r.password)) {
      r.password = await hashPassword(r.password)
    }
  }
  for (const u of cfg.users ?? []) {
    if (u.password && !isHashed(u.password)) {
      u.password = await hashPassword(u.password)
    }
  }
  await env.FORECAST_KV.put(KEY, JSON.stringify(cfg))
  return json({ ok: true })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
