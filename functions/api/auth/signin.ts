import { verifyPassword } from '../../_lib/password'

interface Env {
  FORECAST_KV: KVNamespace
}

type Role = { id: string; name: string; password: string; modules: string[] }
type LegacyUser = {
  id: string
  vorname: string
  name: string
  kuerzel: string
  personalnummer: string
  password: string
  roleId: string
}
type AccessConfig = { roles: Role[]; users?: LegacyUser[] }
type RosterEmployee = {
  id: string
  vorname?: string
  name?: string
  kuerzel?: string
  personalnummer?: string
  password?: string
  roleId?: string
}
type Roster = { employees?: RosterEmployee[] }

const ACCESS_KEY = 'settings:access'
const ROSTER_KEY = 'roster'

function displayNameOf(vorname: string | undefined, name: string | undefined, kuerzel: string) {
  const parts = [vorname, name].filter((s) => s && s.trim().length > 0) as string[]
  return parts.length > 0 ? parts.join(' ') : kuerzel
}

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
  const accessRaw = await env.FORECAST_KV.get(ACCESS_KEY)
  const cfg = accessRaw ? (JSON.parse(accessRaw) as AccessConfig) : null

  if (kuerzel) {
    const rosterRaw = await env.FORECAST_KV.get(ROSTER_KEY)
    const roster = rosterRaw ? (JSON.parse(rosterRaw) as Roster) : null
    const rosterCandidate = roster?.employees?.find((e) => e.kuerzel === kuerzel)
    if (rosterCandidate?.password && rosterCandidate.kuerzel && rosterCandidate.roleId) {
      const check = await verifyPassword(rosterCandidate.password, password)
      if (!check.ok) return json({ error: 'invalid credentials' }, 401)
      if (check.upgradeTo && roster) {
        rosterCandidate.password = check.upgradeTo
        await env.FORECAST_KV.put(ROSTER_KEY, JSON.stringify(roster))
      }
      const role = cfg?.roles.find((r) => r.id === rosterCandidate.roleId)
      if (!role) return json({ error: 'role missing for user' }, 401)
      return json({
        ok: true,
        role: { id: role.id, name: role.name, modules: role.modules },
        user: {
          id: rosterCandidate.id,
          kuerzel: rosterCandidate.kuerzel,
          displayName: displayNameOf(
            rosterCandidate.vorname,
            rosterCandidate.name,
            rosterCandidate.kuerzel,
          ),
        },
      })
    }
    const legacy = cfg?.users?.find((u) => u.kuerzel === kuerzel)
    if (!legacy) return json({ error: 'invalid credentials' }, 401)
    const check = await verifyPassword(legacy.password, password)
    if (!check.ok) return json({ error: 'invalid credentials' }, 401)
    if (check.upgradeTo && cfg) {
      legacy.password = check.upgradeTo
      await env.FORECAST_KV.put(ACCESS_KEY, JSON.stringify(cfg))
    }
    const role = cfg?.roles.find((r) => r.id === legacy.roleId)
    if (!role) return json({ error: 'role missing for user' }, 401)
    return json({
      ok: true,
      role: { id: role.id, name: role.name, modules: role.modules },
      user: {
        id: legacy.id,
        kuerzel: legacy.kuerzel,
        displayName: displayNameOf(legacy.vorname, legacy.name, legacy.kuerzel),
      },
    })
  }

  const role = cfg?.roles.find((r) => r.id === roleId)
  if (!role) return json({ error: 'invalid credentials' }, 401)
  const check = await verifyPassword(role.password, password)
  if (!check.ok) return json({ error: 'invalid credentials' }, 401)
  if (check.upgradeTo && cfg) {
    role.password = check.upgradeTo
    await env.FORECAST_KV.put(ACCESS_KEY, JSON.stringify(cfg))
  }
  return json({ ok: true, role: { id: role.id, name: role.name, modules: role.modules } })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
