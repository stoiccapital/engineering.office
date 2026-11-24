export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  })
}

export function error(status: number, code: string, message?: string): Response {
  return json({ error: code, ...(message ? { message } : {}) }, status)
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code)
  }
}

// Reads a JSON body with a size cap. Throws HttpError on bad input.
export async function readJson<T = unknown>(request: Request, maxBytes = 100_000): Promise<T> {
  const text = await request.text()
  if (text.length > maxBytes) throw new HttpError(413, 'too large')
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(400, 'invalid json')
  }
}

export function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

// Wraps a handler so thrown HttpErrors become JSON responses.
export function handle<C>(fn: (ctx: C) => Promise<Response>): (ctx: C) => Promise<Response> {
  return async (ctx) => {
    try {
      return await fn(ctx)
    } catch (e) {
      if (e instanceof HttpError) return error(e.status, e.code, e.message !== e.code ? e.message : undefined)
      console.error('[api] unhandled', e)
      return error(500, 'internal error')
    }
  }
}
