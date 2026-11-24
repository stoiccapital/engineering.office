// Hourly snapshot endpoint, still triggered by the Cloudflare Scheduled
// Worker described in docs/backup-setup.md (same URL, same X-Backup-Secret).
//
// With Postgres, full-database backups belong to the database provider
// (daily backups / point-in-time recovery). This endpoint adds app-level
// restore points: every document changed since its last history row is
// copied into document_history, and snapshot rows older than
// RETENTION_DAYS are pruned. Edit-history rows are kept.
import type { Env } from '../../../server/env'
import type { Data } from '../../../server/routes'
import { json } from '../../../server/http'

const RETENTION_DAYS = 14

export const onRequestPost: PagesFunction<Env, string, Data> = async ({ env, request, data: { sql } }) => {
  if (!env.BACKUP_SECRET) return json({ error: 'backup not configured' }, 503)
  if ((request.headers.get('x-backup-secret') ?? '') !== env.BACKUP_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }

  const snap = await sql`
    insert into document_history (key, version, data, reason, changed_by)
    select d.key, d.version, d.data, 'snapshot', d.updated_by
    from documents d
    where not exists (
      select 1 from document_history h where h.key = d.key and h.version = d.version
    )
  `
  const pruned = await sql`
    delete from document_history
    where reason = 'snapshot' and changed_at < now() - make_interval(days => ${RETENTION_DAYS})
  `
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from documents`

  return json({
    ok: true,
    stamp: new Date().toISOString(),
    documents: count,
    snapshotCount: snap.count,
    prunedCount: pruned.count,
  })
}

export const onRequestGet: PagesFunction<Env> = ({ env }) => {
  return json({ ok: true, configured: Boolean(env.BACKUP_SECRET), retentionDays: RETENTION_DAYS })
}
