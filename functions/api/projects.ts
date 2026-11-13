interface Env {
  FORECAST_KV: KVNamespace
}

// Shared projects document — all users with the 'projekte' module read and
// write the same key. Visibility (my projects vs. all) and edit restrictions
// are enforced client-side.
const KEY = 'projects'

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
  if (body.length > 2_000_000) return json({ error: 'too large' }, 413)
  try {
    JSON.parse(body)
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  await env.FORECAST_KV.put(KEY, body)
  return json({ ok: true })
}
