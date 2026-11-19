import { hashPassword, isHashed } from '../_lib/password'

interface Env {
  FORECAST_KV: KVNamespace
}

type Roster = {
  employees?: { password?: string }[]
  [key: string]: unknown
}

const KEY = 'roster'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const data = await env.FORECAST_KV.get(KEY)
  return new Response(data ?? 'null', {
    headers: { 'content-type': 'application/json' },
  })
}

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const body = await request.text()
  if (body.length > 1_000_000) return json({ error: 'too large' }, 413)
  let roster: Roster
  try {
    roster = JSON.parse(body) as Roster
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  // Hash any plaintext passwords on save.
  for (const e of roster.employees ?? []) {
    if (e.password && !isHashed(e.password)) {
      e.password = await hashPassword(e.password)
    }
  }
  await env.FORECAST_KV.put(KEY, JSON.stringify(roster))
  return json({ ok: true })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
