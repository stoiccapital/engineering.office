interface Env {
  FORECAST_KV: KVNamespace
}

const KEY = 'settings:logo'
const MAX_LEN = 700_000 // ~500 KB raw image after base64 overhead

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const dataUrl = await env.FORECAST_KV.get(KEY)
  return json({ dataUrl: dataUrl ?? null })
}

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  let body: { dataUrl?: string }
  try {
    body = (await request.json()) as { dataUrl?: string }
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const dataUrl = body?.dataUrl
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return json({ error: 'invalid image' }, 400)
  }
  if (dataUrl.length > MAX_LEN) return json({ error: 'too large' }, 413)
  await env.FORECAST_KV.put(KEY, dataUrl)
  return json({ ok: true })
}

export const onRequestDelete: PagesFunction<Env> = async ({ env }) => {
  await env.FORECAST_KV.delete(KEY)
  return json({ ok: true })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
