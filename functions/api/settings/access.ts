interface Env {
  FORECAST_KV: KVNamespace
}

const KEY = 'settings:access'
const MAX_LEN = 100_000

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.FORECAST_KV.get(KEY)
  return json(raw ? JSON.parse(raw) : null)
}

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const text = await request.text()
  if (text.length > MAX_LEN) return json({ error: 'too large' }, 413)
  try {
    JSON.parse(text)
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  await env.FORECAST_KV.put(KEY, text)
  return json({ ok: true })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
