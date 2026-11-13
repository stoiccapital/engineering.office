interface Env {
  FORECAST_KV: KVNamespace
}

const KEY = 'projektliste'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const data = await env.FORECAST_KV.get(KEY)
  return new Response(data ?? 'null', {
    headers: { 'content-type': 'application/json' },
  })
}

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const body = await request.text()
  // 10 MB cap — the Excel can have hundreds of rows with free text.
  if (body.length > 10_000_000) return json({ error: 'too large' }, 413)
  try {
    JSON.parse(body)
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  await env.FORECAST_KV.put(KEY, body)
  return json({ ok: true })
}
