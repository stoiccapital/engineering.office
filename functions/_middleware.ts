interface Env {
  AUTH: string
  FORECAST_KV: KVNamespace
}

type Role = { id: string; name: string; password: string; modules: string[] }
type User = {
  id: string
  kuerzel: string
  password: string
  roleId: string
}
type AccessConfig = { roles: Role[]; users?: User[] }
type RosterEmployee = {
  id: string
  kuerzel?: string
  password?: string
  roleId?: string
}
type Roster = { employees?: RosterEmployee[] }

const ACCESS_KEY = 'settings:access'
const ROSTER_KEY = 'roster'

// Paths past the shared AUTH that don't need role credentials. Used before any
// role exists (first boot) or during the login flow itself.
const EXEMPT = new Set([
  '/api/auth-check',
  '/api/auth/signin',
  '/api/settings/roles',
  '/api/settings/users',
])

// Logo is pulled on every page load (used by the sidebar brand mark). Keep it
// open past the shared AUTH so role switching doesn't flash blank logos.
const LOGO_PATH = '/api/logo'

// Per-request access rule: which role modules may read vs. write a given path.
// A role needs at least one of the listed modules.
type Access = { get: string[]; put: string[] }

function accessForPath(pathname: string): Access | null {
  if (pathname.startsWith('/api/period/')) {
    return { get: ['dashboard', 'forecast'], put: ['forecast'] }
  }
  if (pathname.startsWith('/api/plan/')) {
    // Employees with plan_overview need PUT to save their own progress
    // updates / Freigabe submissions from the Übersicht tab. Admin-level
    // edits (adding people, poolTasks, cells) still happen only from the
    // Plan tab which is UI-gated behind the full 'plan' module.
    return { get: ['plan', 'plan_overview'], put: ['plan', 'plan_overview'] }
  }
  if (pathname.startsWith('/api/ziele/')) {
    // get: any role with any Ziele sub-module (dashboard, teams, kontrolle)
    // or the legacy 'ziele'/'umsatz' IDs.
    return {
      get: ['ziele', 'umsatz', 'ziele_dashboard', 'ziele_teams', 'ziele_kontrolle'],
      put: ['ziele', 'ziele_teams'],
    }
  }
  if (pathname.startsWith('/api/umsatz/')) {
    return { get: ['umsatz', 'ziele_kontrolle'], put: ['umsatz', 'ziele_kontrolle'] }
  }
  if (pathname.startsWith('/api/rechnungsplan/')) {
    return { get: ['rechnungen'], put: ['rechnungen'] }
  }
  if (pathname === '/api/roster') {
    return { get: ['mitarbeiter'], put: ['mitarbeiter'] }
  }
  if (pathname === '/api/kostenschaetzung') {
    return {
      get: ['kostenschaetzung', 'ks_bauwerke', 'ks_hoai', 'ks_katalog'],
      put: ['kostenschaetzung', 'ks_bauwerke', 'ks_hoai', 'ks_katalog'],
    }
  }
  if (pathname === '/api/activity') {
    // GET admin-only; POST allowed for any authed user (writes own events).
    return { get: ['settings'], put: ['*'] }
  }
  if (pathname === '/api/settings/access') return { get: ['settings'], put: ['settings'] }
  return null
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) return next()

  if (EXEMPT.has(url.pathname) || url.pathname === LOGO_PATH) return next()

  // Bootstrap window: on fresh KV with no roles yet, allow a single write to
  // /api/settings/access so the first admin role can be created. After that it
  // requires admin role credentials like any other write.
  if (
    url.pathname === '/api/settings/access' &&
    (request.method === 'PUT' || request.method === 'POST')
  ) {
    const raw = await env.FORECAST_KV.get(ACCESS_KEY)
    const cfg = raw ? (JSON.parse(raw) as AccessConfig) : null
    if (!cfg || cfg.roles.length === 0) return next()
  }

  // Prefer per-user auth; fall back to legacy role auth for bootstrap.
  const userAuth = request.headers.get('x-user-auth') ?? ''
  const roleAuth = request.headers.get('x-role-auth') ?? ''
  if (!userAuth && !roleAuth) return unauthorized('auth missing')

  const raw = await env.FORECAST_KV.get(ACCESS_KEY)
  const cfg = raw ? (JSON.parse(raw) as AccessConfig) : null

  let role: Role | undefined
  if (userAuth) {
    const idx = userAuth.indexOf(':')
    if (idx === -1) return unauthorized('user auth malformed')
    const kuerzel = userAuth.slice(0, idx)
    const password = userAuth.slice(idx + 1)
    if (!kuerzel || !password) return unauthorized('user auth malformed')
    // Try Roster first (canonical), fall back to legacy accessConfig.users
    // so existing deployments keep working while admins migrate.
    const rosterRaw = await env.FORECAST_KV.get(ROSTER_KEY)
    const roster = rosterRaw ? (JSON.parse(rosterRaw) as Roster) : null
    const rosterMatch = roster?.employees?.find(
      (e) => e.kuerzel && e.kuerzel === kuerzel && e.password === password,
    )
    if (rosterMatch && rosterMatch.roleId) {
      role = cfg?.roles.find((r) => r.id === rosterMatch.roleId)
      if (!role) return unauthorized('role missing for user')
    } else {
      const user = cfg?.users?.find((u) => u.kuerzel === kuerzel)
      if (!user || user.password !== password) return unauthorized('invalid user')
      role = cfg?.roles.find((r) => r.id === user.roleId)
      if (!role) return unauthorized('role missing for user')
    }
  } else {
    const idx = roleAuth.indexOf(':')
    if (idx === -1) return unauthorized('role auth malformed')
    const roleId = roleAuth.slice(0, idx)
    const password = roleAuth.slice(idx + 1)
    if (!roleId || !password) return unauthorized('role auth malformed')
    role = cfg?.roles.find((r) => r.id === roleId)
    if (!role || role.password !== password) return unauthorized('invalid role')
  }

  const rule = accessForPath(url.pathname)
  if (!rule) return next() // unknown path — let the route 404 itself.

  const required = request.method === 'GET' ? rule.get : rule.put
  // '*' = any authed user (role already validated above).
  const ok = required.includes('*') || required.some((m) => role.modules.includes(m))
  if (!ok) return forbidden()

  return next()
}

function unauthorized(reason = 'unauthorized') {
  return new Response(JSON.stringify({ error: reason }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })
}

function forbidden() {
  return new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  })
}
