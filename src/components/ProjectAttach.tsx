/**
 * Small inline affordance: + Projekt button → Radix popover with Projektliste
 * search + keyboard nav. When a project is attached, shows a pill that can
 * detach. Used by Forecast rows, Rechnungen rows, and anywhere else that
 * needs to link to the Projektliste catalog.
 *
 * Principles: see docs/principles.md §1 (one source of truth) and §5
 * (verbs, not navigation). Mouse-first dropdown, inline — no modal.
 */
import * as Popover from '@radix-ui/react-popover'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useProjektliste } from '@/projektliste-store'
import { filterProjekte, findProjekt } from '@/lib/project-lookup'
import { cn } from '@/lib/utils'

export function ProjectAttach({
  projectId,
  onChange,
  disabled,
  compact,
}: {
  projectId: string | undefined
  onChange: (id: string | undefined) => void
  disabled?: boolean
  /** When compact, the "+ Projekt" button is small-style and shows no label on narrow widths. */
  compact?: boolean
}) {
  const rows = useProjektliste((s) => s.doc?.rows ?? [])
  const status = useProjektliste((s) => s.status)
  const load = useProjektliste((s) => s.load)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (open && status === 'idle') void load()
  }, [open, status, load])
  useEffect(() => {
    if (!open) {
      setQuery('')
      setIdx(0)
    }
  }, [open])

  const attached = findProjekt(rows, projectId)
  const filtered = filterProjekte(rows, query)

  useEffect(() => {
    if (idx > 0 && idx >= filtered.length) setIdx(0)
  }, [idx, filtered.length])

  if (attached) {
    return (
      <button
        type="button"
        onClick={() => onChange(undefined)}
        disabled={disabled}
        className="inline-flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        title={`Verknüpfung zu „${attached.projekt}" lösen`}
      >
        <span className="truncate">{attached.projekt || attached.id}</span>
        <X className="h-2.5 w-2.5 shrink-0" />
      </button>
    )
  }

  if (disabled) return null

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground',
            compact && 'px-1',
          )}
          title="Projekt aus Projektliste wählen"
        >
          <Plus className="h-2.5 w-2.5" />
          {compact ? '' : 'Projekt'}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          side="bottom"
          sideOffset={4}
          className="z-50 w-80 rounded-md border bg-card p-1 focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIdx(0)
            }}
            onKeyDown={(e) => {
              if (filtered.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((i) => (i + 1) % filtered.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((i) => (i - 1 + filtered.length) % filtered.length)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const p = filtered[idx] ?? filtered[0]
                if (p) {
                  onChange(p.id)
                  setOpen(false)
                }
              }
            }}
            placeholder="Projekt suchen…"
            className="mb-1 w-full rounded bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {status === 'loading' ? 'Projekte werden geladen …' : 'Kein Projekt gefunden.'}
              </div>
            ) : (
              filtered.map((row, i) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    onChange(row.id)
                    setOpen(false)
                  }}
                  onMouseEnter={() => setIdx(i)}
                  className={cn(
                    'flex w-full flex-col items-stretch rounded px-2 py-1 text-left',
                    i === idx ? 'bg-accent text-foreground' : 'hover:bg-muted',
                  )}
                >
                  <span className="line-clamp-2 text-xs font-medium leading-snug">
                    {row.projekt || (
                      <span className="italic text-muted-foreground">ohne Namen</span>
                    )}
                  </span>
                  {(row.fachbereich || row.projektleiter) && (
                    <span className="truncate text-[10px] text-muted-foreground">
                      {[row.fachbereich, row.projektleiter].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
