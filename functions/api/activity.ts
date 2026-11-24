import { handle, error, json, readJson, str } from '../../server/http'
import { userLabel } from '../../server/auth'
import { requireUser, type Ctx } from '../../server/routes'

const MAX_DAYS = 90

type ActivityEvent = {
  ts: string
  user: string
  kind: 'login' | 'view' | 'action'
  module?: string
  action?: string
  target?: string
}

export const onRequestGet = handle<Ctx>(async (ctx) => {
  const url = new URL(ctx.request.url)
  const daysParam = Number(url.searchParams.get('days') ?? '7')
  const days = Math.max(1, Math.min(MAX_DAYS, Number.isFinite(daysParam) ? daysParam : 7))
  // Same window as before: today (UTC) plus the previous days-1 UTC days.
  const rows = await ctx.data.sql<
    { ts: Date; user_label: string; kind: ActivityEvent['kind']; module: string | null; action: string | null; target: string | null }[]
  >`
    select ts, user_label, kind, module, action, target
    from activity_events
    where ts >= (date_trunc('day', now() at time zone 'UTC') - make_interval(days => ${days - 1})) at time zone 'UTC'
    order by ts desc
    limit 50000
  `
  const events: ActivityEvent[] = rows.map((r) => ({
    ts: new Date(r.ts).toISOString(),
    user: r.user_label,
    kind: r.kind,
    ...(r.module ? { module: r.module } : {}),
    ...(r.action ? { action: r.action } : {}),
    ...(r.target ? { target: r.target } : {}),
  }))
  return json(events)
})

export const onRequestPost = handle<Ctx>(async (ctx) => {
  const user = requireUser(ctx)
  const ev = await readJson<Partial<ActivityEvent> | null>(ctx.request, 10_000)
  if (!ev || typeof ev.kind !== 'string' || !['login', 'view', 'action'].includes(ev.kind)) {
    return error(400, 'invalid event')
  }
  // The actor is taken from the session, not from the request body.
  await ctx.data.sql`
    insert into activity_events (user_id, user_label, kind, module, action, target)
    values (${user.id}, ${userLabel(user).slice(0, 64)}, ${ev.kind},
            ${str(ev.module, 64) || null}, ${str(ev.action, 128) || null}, ${str(ev.target, 256) || null})
  `
  return json({ ok: true })
})
