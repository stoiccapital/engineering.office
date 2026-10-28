interface Env {
  AUTH: string
  FORECAST_KV: KVNamespace
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) return next()

  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!env.AUTH || token !== env.AUTH) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return next()
}
