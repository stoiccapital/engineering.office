import type { Env } from '../server/env'
import { createSql } from '../server/db'
import { currentUser } from '../server/auth'
import { error } from '../server/http'
import type { Data } from '../server/routes'

// Endpoints that run without a user session: the sign-in / sign-up flows,
// and the cron endpoints which carry their own shared-secret header.
function isPublic(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/auth/')) return true
  if (pathname.startsWith('/api/admin/')) return true
  // Logo is pulled on every page load, including the sign-in screen.
  if (pathname === '/api/logo' && method === 'GET') return true
  return false
}

// Per-request access rule: which role modules may read vs. write a given path.
// A role needs at least one of the listed modules. Unchanged from the KV era.
type Access = { get: string[]; put: string[] }

function accessForPath(pathname: string): Access | null {
  if (pathname.startsWith('/api/period/')) {
    return { get: ['dashboard', 'forecast'], put: ['forecast'] }
  }
  if (pathname.startsWith('/api/plan/')) {
    // Employees with plan_overview need PUT to save their own progress
    // updates / Freigabe submissions from the Übersicht tab.
    return { get: ['plan', 'plan_overview'], put: ['plan', 'plan_overview'] }
  }
  if (pathname.startsWith('/api/ziele/')) {
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
  if (pathname === '/api/projektliste') {
    return { get: ['*'], put: ['*'] }
  }
  if (pathname === '/api/activity') {
    // GET admin-only; POST allowed for any authed user (writes own events).
    return { get: ['settings'], put: ['*'] }
  }
  if (pathname === '/api/settings/access') return { get: ['settings'], put: ['settings'] }
  if (pathname.startsWith('/api/settings/accounts')) return { get: ['settings'], put: ['settings'] }
  return null
}

export const onRequest: PagesFunction<Env, string, Data> = async (ctx) => {
  const { request, data, next, waitUntil } = ctx
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) return next()

  // Mutations must be JSON: cross-site forms can't send that without a CORS
  // preflight, which (together with SameSite=Lax cookies) blocks CSRF.
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'DELETE') {
    const ct = request.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) return error(415, 'json required')
  }

  let sql
  try {
    sql = createSql(ctx.env)
  } catch (e) {
    console.error('[db]', (e as Error).message)
    return error(503, 'database not configured')
  }
  data.sql = sql
  try {
    if (isPublic(url.pathname, request.method)) return await next()

    const user = await currentUser(sql, request)
    if (!user) return error(401, 'unauthorized')
    if (!user.role) return error(403, 'no role', 'Konto wartet auf Freigabe durch einen Administrator')
    data.user = user

    const rule = accessForPath(url.pathname)
    if (!rule) return await next() // no module restriction for this path

    const required = request.method === 'GET' ? rule.get : rule.put
    const modules = user.role.modules
    const ok = required.includes('*') || required.some((m) => modules.includes(m))
    if (!ok) return error(403, 'forbidden')

    return await next()
  } catch (e) {
    console.error('[api] middleware', e)
    return error(500, 'internal error')
  } finally {
    waitUntil(sql.end({ timeout: 5 }))
  }
}
