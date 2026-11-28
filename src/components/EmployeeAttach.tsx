/**
 * Inline employee (Projektleiter / Mitarbeiter) picker.
 *
 * Mirrors ProjectAttach but sources from useRoster. Used by Forecast
 * (projektleiterDE / projektleiterPL), Rechnungen (pl), Projektliste
 * (projektleiter). Writes a Kürzel (stable short string) because that's
 * what the existing stored fields hold today — enables backward compat.
 *
 * See docs/principles.md §1 (one source of truth): the roster is the
 * authoritative employee catalog; free-text PL fields drift otherwise.
 */
import * as Popover from '@radix-ui/react-popover'
import { Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useRoster } from '@/roster-store'
import type { RosterEmployee } from '@/types'
import { cn } from '@/lib/utils'

export type EmployeeBranchFilter = 'de' | 'pl' | 'all'

export function EmployeeAttach({
  value,
  onChange,
  disabled,
  branch = 'all',
  placeholder = 'PL',
}: {
  /** Stored Kürzel (or free-typed name). Empty string = not set. */
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  /** Filter the roster by branch. 'all' shows everyone. */
  branch?: EmployeeBranchFilter
  placeholder?: string
}) {
  const roster = useRoster((s) => s.roster)
  const loadRoster = useRoster((s) => s.load)
  const rosterStatus = useRoster((s) => s.status)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (open && rosterStatus === 'idle') void loadRoster()
  }, [open, rosterStatus, loadRoster])
  useEffect(() => {
    if (!open) {
      setQuery('')
      setIdx(0)
    }
  }, [open])

  const employees = useMemo<RosterEmployee[]>(() => {
    const all = roster?.employees ?? []
    if (branch === 'all') return all
    // Branch filter: map team.locationId → location code (teams live under
    // locations; location name heuristic matches "DE" / "PL"). We filter
    // defensively — missing team/location passes through to keep it usable.
    const teamsById = new Map((roster?.teams ?? []).map((t) => [t.id, t]))
    const locationsById = new Map((roster?.locations ?? []).map((l) => [l.id, l]))
    const wanted = branch === 'de' ? ['de', 'deutschland', 'germany'] : ['pl', 'polen', 'poland']
    return all.filter((e) => {
      const team = e.teamId ? teamsById.get(e.teamId) : undefined
      const location = team?.locationId ? locationsById.get(team.locationId) : undefined
      if (!location) return true
      return wanted.some((w) => location.name.toLowerCase().includes(w))
    })
  }, [roster, branch])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    const rows = q
      ? employees.filter(
          (e) =>
            (e.kuerzel ?? '').toLowerCase().includes(q) ||
            e.vorname.toLowerCase().includes(q) ||
            e.name.toLowerCase().includes(q),
        )
      : employees
    return rows.slice(0, 10)
  }, [employees, query])

  useEffect(() => {
    if (idx > 0 && idx >= filtered.length) setIdx(0)
  }, [idx, filtered.length])

  const setValue = (next: string) => {
    onChange(next)
    setOpen(false)
  }
  const clear = () => onChange('')

  // Attached view: short pill with the current Kürzel + × to clear.
  if (value) {
    return (
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          title="Projektleiter ändern"
        >
          {value}
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
            title="Entfernen"
            aria-label="Projektleiter entfernen"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
        {/* Shared popover: opens when the attached pill is clicked to swap. */}
        <PickerPopover
          open={open}
          setOpen={setOpen}
          query={query}
          setQuery={setQuery}
          idx={idx}
          setIdx={setIdx}
          filtered={filtered}
          status={rosterStatus}
          onPick={setValue}
          hiddenTrigger
        />
      </div>
    )
  }

  if (disabled) return null

  return (
    <PickerPopover
      open={open}
      setOpen={setOpen}
      query={query}
      setQuery={setQuery}
      idx={idx}
      setIdx={setIdx}
      filtered={filtered}
      status={rosterStatus}
      onPick={setValue}
      placeholder={placeholder}
    />
  )
}

function PickerPopover({
  open,
  setOpen,
  query,
  setQuery,
  idx,
  setIdx,
  filtered,
  status,
  onPick,
  placeholder = 'PL',
  hiddenTrigger,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  query: string
  setQuery: (q: string) => void
  idx: number
  setIdx: (n: number | ((p: number) => number)) => void
  filtered: RosterEmployee[]
  status: string
  onPick: (kuerzel: string) => void
  placeholder?: string
  hiddenTrigger?: boolean
}) {
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {hiddenTrigger ? (
          <span className="sr-only" aria-hidden />
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent"
            title="Projektleiter wählen"
          >
            <Plus className="h-2.5 w-2.5" />
            {placeholder}
          </button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          side="bottom"
          sideOffset={4}
          className="z-50 w-64 rounded-md border bg-card p-1 focus:outline-none"
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
                if (p?.kuerzel) onPick(p.kuerzel)
              }
            }}
            placeholder="Kürzel, Vorname, Name…"
            className="mb-1 w-full rounded bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {status === 'loading' ? 'Mitarbeiter werden geladen …' : 'Keine Treffer.'}
              </div>
            ) : (
              filtered.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => e.kuerzel && onPick(e.kuerzel)}
                  onMouseEnter={() => setIdx(i)}
                  disabled={!e.kuerzel}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs disabled:opacity-50',
                    i === idx ? 'bg-accent text-foreground' : 'hover:bg-muted',
                  )}
                >
                  <span className="shrink-0 font-mono text-[11px] font-semibold">
                    {e.kuerzel || '—'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {e.vorname} {e.name}
                  </span>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
