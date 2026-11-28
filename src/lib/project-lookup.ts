/**
 * Shared Projektliste lookup — used by any store or component that links to
 * a project via `projectId`. Follow docs/principles.md §1 ("one source of
 * truth per entity"): when `projectId` is set, show/read the catalog's
 * values; the row's own stored fields stay for backward compat with legacy
 * free-text rows.
 */
import type { ProjektlisteRow } from '@/types'

export function findProjekt(
  rows: readonly ProjektlisteRow[],
  projectId: string | undefined,
): ProjektlisteRow | undefined {
  if (!projectId) return undefined
  return rows.find((r) => r.id === projectId)
}

/** Display name for a row that may or may not be linked. */
export function projektDisplayName(
  rows: readonly ProjektlisteRow[],
  projectId: string | undefined,
  fallback: string,
): string {
  const p = findProjekt(rows, projectId)
  return p?.projekt || fallback
}

/** Resolve the PL (Projektleiter) label for a linked row. */
export function projektPLLabel(
  rows: readonly ProjektlisteRow[],
  projectId: string | undefined,
  fallback: string,
): string {
  const p = findProjekt(rows, projectId)
  return p?.projektleiter || fallback
}

/** Filter helper reused across pickers. */
export function filterProjekte(
  rows: readonly ProjektlisteRow[],
  query: string,
  limit = 8,
): ProjektlisteRow[] {
  const q = query.toLowerCase().trim()
  const matched = q
    ? rows.filter(
        (r) =>
          r.projekt.toLowerCase().includes(q) ||
          r.fachbereich.toLowerCase().includes(q) ||
          r.projektleiter.toLowerCase().includes(q),
      )
    : rows
  return matched.slice(0, limit)
}
