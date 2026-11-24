import { deleteDoc, getDoc, putDoc } from '../../server/documents'
import { handle, error, json, readJson } from '../../server/http'
import { requireUser, type Ctx } from '../../server/routes'

const KEY = 'settings:logo'
const MAX_LEN = 14_000_000 // ~10 MB raw image after base64 overhead

// Stored as a JSON string document holding the data URL.
export const onRequestGet = handle<Ctx>(async (ctx) => {
  const dataUrl = await getDoc<string>(ctx.data.sql, KEY)
  return json({ dataUrl: typeof dataUrl === 'string' ? dataUrl : null })
})

export const onRequestPut = handle<Ctx>(async (ctx) => {
  const body = await readJson<{ dataUrl?: unknown }>(ctx.request, MAX_LEN + 100)
  const dataUrl = body?.dataUrl
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return error(400, 'invalid image')
  if (dataUrl.length > MAX_LEN) return error(413, 'too large')
  await putDoc(ctx.data.sql, KEY, dataUrl, requireUser(ctx).id)
  return json({ ok: true })
})

export const onRequestDelete = handle<Ctx>(async (ctx) => {
  await deleteDoc(ctx.data.sql, KEY, requireUser(ctx).id)
  return json({ ok: true })
})
