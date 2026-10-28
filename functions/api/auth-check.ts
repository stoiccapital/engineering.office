export const onRequest: PagesFunction = async () => {
  // Middleware already validated the token. If we're here, we're in.
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  })
}
