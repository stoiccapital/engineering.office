// Snapshot backup endpoint for the Pages KV namespace. Triggered hourly by a
// Cloudflare Scheduled Worker (see docs/backup-setup.md) that fetches this
// URL with a shared secret header.
//
// Each call snapshots every live key we care about into `bak-YYYY-MM-DD-HH:<key>`
// and deletes any snapshot older than RETENTION_DAYS. Both steps iterate with
// the KV cursor so arbitrarily-large key sets stay handled.

interface Env {
  FORECAST_KV: KVNamespace
  BACKUP_SECRET: string
}

const RETENTION_DAYS = 14

// Keys backed up by prefix — listed via env.FORECAST_KV.list().
const BACKUP_PREFIXES = [
  'plan-',
  'rechnungsplan-',
  'ziele-',
  'umsatz-',
  'forecast-period:',
]

// Single top-level keys we always snapshot.
const BACKUP_SINGLES = [
  'hr',
  'roster',
  'settings:access',
  'logo',
  'kostenschaetzung',
  'kostenermittlung',
  'katalogOverrides',
  'projektliste',
]

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  // Shared-secret auth. The endpoint is middleware-exempt because it has no
  // user session — the cron trigger carries this header instead.
  const provided = request.headers.get('x-backup-secret') ?? ''
  if (!env.BACKUP_SECRET) {
    return json({ error: 'backup not configured' }, 503)
  }
  if (provided !== env.BACKUP_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }

  const now = new Date()
  const stamp = formatStamp(now)

  const backedUp: string[] = []
  const deleted: string[] = []
  const failed: { key: string; op: 'read' | 'write' | 'delete'; error: string }[] = []

  // Gather all live keys we want to snapshot.
  const liveKeys = new Set<string>(BACKUP_SINGLES)
  for (const prefix of BACKUP_PREFIXES) {
    let cursor: string | undefined
    do {
      const result = await env.FORECAST_KV.list({ prefix, cursor })
      for (const k of result.keys) {
        if (!k.name.startsWith('bak-')) liveKeys.add(k.name)
      }
      cursor = result.list_complete ? undefined : result.cursor
    } while (cursor)
  }

  // Snapshot each live key.
  for (const key of liveKeys) {
    try {
      const value = await env.FORECAST_KV.get(key)
      if (value === null) continue
      try {
        await env.FORECAST_KV.put(`bak-${stamp}:${key}`, value)
        backedUp.push(key)
      } catch (e) {
        failed.push({ key, op: 'write', error: (e as Error).message })
      }
    } catch (e) {
      failed.push({ key, op: 'read', error: (e as Error).message })
    }
  }

  // Retention: delete snapshots older than cutoff.
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS)
  const cutoffDate = formatStamp(cutoff).slice(0, 10) // "YYYY-MM-DD"
  {
    let cursor: string | undefined
    do {
      const result = await env.FORECAST_KV.list({ prefix: 'bak-', cursor })
      for (const k of result.keys) {
        const dateFromKey = k.name.slice(4, 14) // "bak-YYYY-MM-DD"
        if (dateFromKey < cutoffDate) {
          try {
            await env.FORECAST_KV.delete(k.name)
            deleted.push(k.name)
          } catch (e) {
            failed.push({ key: k.name, op: 'delete', error: (e as Error).message })
          }
        }
      }
      cursor = result.list_complete ? undefined : result.cursor
    } while (cursor)
  }

  return json(
    {
      ok: true,
      stamp,
      liveKeys: liveKeys.size,
      backedUpCount: backedUp.length,
      deletedCount: deleted.length,
      failedCount: failed.length,
      failed: failed.slice(0, 20), // cap payload size
    },
    200,
  )
}

// GET returns a lightweight health check so operators can confirm the
// endpoint exists without running a full backup.
export const onRequestGet: PagesFunction<Env> = ({ env }) => {
  return json({
    ok: true,
    configured: Boolean(env.BACKUP_SECRET),
    retentionDays: RETENTION_DAYS,
    prefixes: BACKUP_PREFIXES,
    singles: BACKUP_SINGLES,
  })
}

function formatStamp(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  return `${y}-${m}-${day}-${h}`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
