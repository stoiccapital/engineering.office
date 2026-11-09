interface Env {
  FORECAST_KV: KVNamespace
}

type LegacyUser = {
  id: string
  vorname: string
  name: string
  kuerzel: string
}
type AccessConfig = { users?: LegacyUser[] }
type RosterEmployee = {
  id: string
  vorname?: string
  name?: string
  kuerzel?: string
}
type Roster = { employees?: RosterEmployee[] }

const ACCESS_KEY = 'settings:access'
const ROSTER_KEY = 'roster'

// Public: returns id + kuerzel + display name for the login dropdown. Reads
// from both the Roster (canonical) and legacy AccessConfig.users and merges
// by id so admins can migrate gradually without breaking login lists.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [accessRaw, rosterRaw] = await Promise.all([
    env.FORECAST_KV.get(ACCESS_KEY),
    env.FORECAST_KV.get(ROSTER_KEY),
  ])
  const cfg = accessRaw ? (JSON.parse(accessRaw) as AccessConfig) : null
  const roster = rosterRaw ? (JSON.parse(rosterRaw) as Roster) : null
  type PublicUser = { id: string; kuerzel: string; displayName: string }
  const seen = new Set<string>()
  const out: PublicUser[] = []

  for (const e of roster?.employees ?? []) {
    if (!e.kuerzel) continue
    seen.add(e.id)
    const parts = [e.vorname, e.name].filter((s) => s && s.trim().length > 0) as string[]
    out.push({
      id: e.id,
      kuerzel: e.kuerzel,
      displayName: parts.length > 0 ? parts.join(' ') : e.kuerzel,
    })
  }
  for (const u of cfg?.users ?? []) {
    if (seen.has(u.id)) continue
    const parts = [u.vorname, u.name].filter((s) => s && s.trim().length > 0) as string[]
    out.push({
      id: u.id,
      kuerzel: u.kuerzel,
      displayName: parts.length > 0 ? parts.join(' ') : u.kuerzel,
    })
  }
  return new Response(JSON.stringify(out), {
    headers: { 'content-type': 'application/json' },
  })
}
