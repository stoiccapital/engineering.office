interface Env {
  FORECAST_KV: KVNamespace
}

const MAX_DAYS = 90
const MAX_EVENTS_PER_DAY = 20_000

type ActivityEvent = {
  ts: string
  user: string
  kind: 'login' | 'view' | 'action'
  module?: string
  action?: string
  target?: string
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `activity-${y}-${m}-${day}`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url)
  const daysParam = Number(url.searchParams.get('days') ?? '7')
  const days = Math.max(1, Math.min(MAX_DAYS, Number.isFinite(daysParam) ? daysParam : 7))
  const now = new Date()
  const keys: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    keys.push(dayKey(d))
  }
  const results = await Promise.all(keys.map((k) => env.FORECAST_KV.get(k)))
  const events: ActivityEvent[] = []
  for (const raw of results) {
    if (!raw) continue
    try {
      const arr = JSON.parse(raw) as ActivityEvent[]
      if (Array.isArray(arr)) events.push(...arr)
    } catch {
      // skip corrupt entry
    }
  }
  events.sort((a, b) => (a.ts < b.ts ? 1 : -1))
  return json(events)
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const ev = body as Partial<ActivityEvent> | null
  if (
    !ev ||
    typeof ev.user !== 'string' ||
    !ev.user ||
    typeof ev.kind !== 'string' ||
    !['login', 'view', 'action'].includes(ev.kind)
  ) {
    return json({ error: 'invalid event' }, 400)
  }
  const normalized: ActivityEvent = {
    ts: new Date().toISOString(),
    user: String(ev.user).slice(0, 64),
    kind: ev.kind as ActivityEvent['kind'],
    module: ev.module ? String(ev.module).slice(0, 64) : undefined,
    action: ev.action ? String(ev.action).slice(0, 128) : undefined,
    target: ev.target ? String(ev.target).slice(0, 256) : undefined,
  }
  const key = dayKey(new Date())
  const existing = await env.FORECAST_KV.get(key)
  const arr: ActivityEvent[] = existing ? safeParseArray(existing) : []
  if (arr.length >= MAX_EVENTS_PER_DAY) {
    return json({ ok: true, skipped: 'daily cap reached' })
  }
  arr.push(normalized)
  await env.FORECAST_KV.put(key, JSON.stringify(arr))
  return json({ ok: true })
}

function safeParseArray(raw: string): ActivityEvent[] {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as ActivityEvent[]) : []
  } catch {
    return []
  }
}
