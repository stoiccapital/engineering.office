import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Search, Trash2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Popover from '@radix-ui/react-popover'
import { useKostenermittlung } from '@/kostenermittlung-store'
import { useProjektliste } from '@/projektliste-store'
import { isLegacyOrphan } from '@/features/kostenermittlung/lib/domain'
import { cn } from '@/lib/utils'
import type { ProjektlisteRow } from '@/types'

type ProjectDisplay = {
  projektId: string
  label: string
  subtitle: string | null
  orphan: boolean
}

function displayFor(
  projektId: string,
  rows: ProjektlisteRow[],
): ProjectDisplay {
  const row = rows.find((r) => r.id === projektId)
  if (row) {
    const sub = [row.projektleiter, row.status].filter(Boolean).join(' · ')
    return {
      projektId,
      label: row.projekt || 'Unbenanntes Projekt',
      subtitle: sub || null,
      orphan: false,
    }
  }
  return {
    projektId,
    label: isLegacyOrphan(projektId)
      ? 'Legacy – manuell zuordnen'
      : 'Unbekanntes Projekt',
    subtitle: 'Nicht mit Projektliste verknüpft',
    orphan: true,
  }
}

export function ProjectPicker({ onNavigateProjektliste }: {
  onNavigateProjektliste: () => void
}) {
  const workspace = useKostenermittlung((s) => s.workspace)
  const activeId = workspace?.activeProjektId ?? null
  const addProject = useKostenermittlung((s) => s.addProject)
  const selectProject = useKostenermittlung((s) => s.selectProject)
  const removeProject = useKostenermittlung((s) => s.removeProject)

  const projektlisteDoc = useProjektliste((s) => s.doc)
  const rows = projektlisteDoc?.rows ?? []

  const projects = workspace?.projects ?? []
  const options = useMemo(
    () => projects.map((p) => displayFor(p.projektId, rows)),
    [projects, rows],
  )
  const activeDisplay = activeId
    ? options.find((o) => o.projektId === activeId) ?? null
    : null

  const [listOpen, setListOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<ProjectDisplay | null>(null)

  return (
    <>
      <div className="flex items-center gap-2 border-b bg-card px-6 py-3">
        <span className="text-xs font-medium text-muted-foreground">
          Projekt
        </span>
        <Popover.Root open={listOpen} onOpenChange={setListOpen}>
          <Popover.Trigger asChild>
            <button
              className={cn(
                'flex min-w-[320px] items-center justify-between gap-2 rounded-md border bg-background px-3 py-1.5 text-left text-sm hover:bg-accent',
                !activeDisplay && 'text-muted-foreground',
              )}
            >
              <div className="min-w-0 flex-1">
                {activeDisplay ? (
                  <>
                    <div className="truncate font-medium text-foreground">
                      {activeDisplay.label}
                    </div>
                    {activeDisplay.subtitle && (
                      <div className="truncate font-mono text-[10px] text-muted-foreground">
                        {activeDisplay.subtitle}
                      </div>
                    )}
                  </>
                ) : (
                  <span>Kein Projekt ausgewählt</span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              className="z-50 w-[360px] rounded-md border bg-card shadow-lg"
            >
              <div className="max-h-80 overflow-auto p-1">
                {options.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Noch keine Projekte.
                  </div>
                )}
                {options.map((o) => {
                  const active = o.projektId === activeId
                  return (
                    <div
                      key={o.projektId}
                      className={cn(
                        'group flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                        active ? 'bg-accent' : 'hover:bg-accent/60',
                      )}
                    >
                      <button
                        onClick={() => {
                          selectProject(o.projektId)
                          setListOpen(false)
                        }}
                        className="flex min-w-0 flex-1 flex-col text-left"
                      >
                        <span
                          className={cn(
                            'truncate',
                            o.orphan && 'italic text-muted-foreground',
                          )}
                        >
                          {o.label}
                        </span>
                        {o.subtitle && (
                          <span className="truncate font-mono text-[10px] text-muted-foreground">
                            {o.subtitle}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setListOpen(false)
                          setConfirmRemove(o)
                        }}
                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        title="Projekt aus Kostenermittlung entfernen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="border-t p-1">
                <button
                  onClick={() => {
                    setListOpen(false)
                    setAddOpen(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                  Projekt hinzufügen
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          Neu
        </button>
      </div>

      <AddProjectDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingIds={new Set(projects.map((p) => p.projektId))}
        rows={rows}
        onPick={(projektId) => {
          addProject(projektId)
          setAddOpen(false)
        }}
        onNavigateProjektliste={() => {
          setAddOpen(false)
          onNavigateProjektliste()
        }}
      />

      <ConfirmRemoveDialog
        project={confirmRemove}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={(projektId) => {
          removeProject(projektId)
          setConfirmRemove(null)
        }}
      />
    </>
  )
}

function AddProjectDialog({
  open,
  onClose,
  existingIds,
  rows,
  onPick,
  onNavigateProjektliste,
}: {
  open: boolean
  onClose: () => void
  existingIds: Set<string>
  rows: ProjektlisteRow[]
  onPick: (projektId: string) => void
  onNavigateProjektliste: () => void
}) {
  const [query, setQuery] = useState('')
  const candidates = useMemo(() => {
    const available = rows.filter((r) => !existingIds.has(r.id))
    const q = query.trim().toLowerCase()
    if (!q) return available
    return available.filter((r) => {
      const hay = `${r.projekt} ${r.projektleiter} ${r.status} ${r.leistung}`.toLowerCase()
      return hay.includes(q)
    })
  }, [rows, existingIds, query])

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card shadow-xl">
          <div className="border-b px-5 py-3">
            <Dialog.Title className="text-sm font-semibold">
              Projekt aus Projektliste wählen
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              Projekte, für die noch keine Kostenermittlung angelegt ist.
            </Dialog.Description>
          </div>
          <div className="border-b bg-muted/30 px-5 py-2">
            <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suche nach Projekt, PM, Status…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-auto">
            {candidates.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                {rows.length === 0 ? (
                  <>
                    Keine Projekte in der Projektliste.
                    <div className="mt-3">
                      <button
                        onClick={onNavigateProjektliste}
                        className="text-foreground underline underline-offset-2 hover:text-primary"
                      >
                        → Projektliste öffnen
                      </button>
                    </div>
                  </>
                ) : query ? (
                  'Keine Treffer.'
                ) : (
                  'Alle Projekte sind bereits angelegt.'
                )}
              </div>
            ) : (
              <ul className="divide-y">
                {candidates.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => onPick(r.id)}
                      className="flex w-full flex-col items-start px-5 py-2.5 text-left hover:bg-accent"
                    >
                      <span className="text-sm font-medium">
                        {r.projekt || 'Unbenanntes Projekt'}
                      </span>
                      <span className="truncate font-mono text-[10px] text-muted-foreground">
                        {[r.projektleiter, r.status].filter(Boolean).join(' · ') ||
                          '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-between gap-2 border-t bg-muted/30 px-5 py-3">
            <button
              onClick={onNavigateProjektliste}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              → Projektliste öffnen
            </button>
            <button
              onClick={onClose}
              className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Schließen
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ConfirmRemoveDialog({
  project,
  onCancel,
  onConfirm,
}: {
  project: ProjectDisplay | null
  onCancel: () => void
  onConfirm: (projektId: string) => void
}) {
  return (
    <Dialog.Root open={project !== null} onOpenChange={(v) => !v && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card shadow-xl">
          <div className="border-b px-5 py-3">
            <Dialog.Title className="text-sm font-semibold">
              Projekt entfernen
            </Dialog.Title>
          </div>
          <div className="px-5 py-4 text-sm">
            Kostenermittlung für{' '}
            <span className="font-medium">{project?.label}</span> wirklich
            löschen? Die Positionen gehen verloren — das Projekt in der
            Projektliste bleibt bestehen.
          </div>
          <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
            <button
              onClick={onCancel}
              className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              onClick={() => project && onConfirm(project.projektId)}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
