interface Env {
  FORECAST_KV: KVNamespace
}

const KEY_RE = /^\d{4}-Q[1-4]$/

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const key = String(params.key)
  if (!KEY_RE.test(key)) return json({ error: 'bad key' }, 400)
  const data = await env.FORECAST_KV.get(key)
  return new Response(data ?? 'null', {
    headers: { 'content-type': 'application/json' },
  })
}

export const onRequestPut: PagesFunction<Env> = async ({ params, env, request }) => {
  const key = String(params.key)
  if (!KEY_RE.test(key)) return json({ error: 'bad key' }, 400)
  const body = await request.text()
  if (body.length > 500_000) return json({ error: 'too large' }, 413)
  try {
    JSON.parse(body)
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  await env.FORECAST_KV.put(key, body)
  return json({ ok: true })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
