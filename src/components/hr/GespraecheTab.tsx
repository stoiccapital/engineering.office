import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Send, Trash2 } from 'lucide-react'
import { useHr } from '@/hr-store'
import { useAccess } from '@/access-store'
import { useRoster } from '@/roster-store'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ModuleId } from '@/types'
import { useFullscreen } from '@/components/ui/use-fullscreen'
import { FullscreenToggle } from '@/components/ui/fullscreen-toggle'

const fmtDateTime = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  })
}

function fullName(e: { vorname: string; name: string; kuerzel?: string }): string {
  const n = [e.vorname, e.name].filter((s) => s.trim().length > 0).join(' ')
  return n || e.kuerzel || '—'
}

export function GespraecheTab() {
  const { ref: containerRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>()
  const doc = useHr((s) => s.doc)
  const postUtterance = useHr((s) => s.postUtterance)
  const removeUtterance = useHr((s) => s.removeUtterance)
  const currentUser = useAccess((s) => s.currentUser)
  const currentRole = useAccess((s) => s.currentRole)
  const roster = useRoster((s) => s.roster)
  const loadRoster = useRoster((s) => s.load)

  const myId = currentUser?.id ?? ''
  const myLabel = currentUser?.displayName || currentUser?.kuerzel || myId
  const canSwitch = useMemo(
    () => (currentRole?.modules as ModuleId[] | undefined)?.includes('hr_team_view') ?? false,
    [currentRole],
  )

  const [activeId, setActiveId] = useState(myId)
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (!canSwitch) setActiveId(myId)
  }, [canSwitch, myId])
  useEffect(() => {
    if (!roster) void loadRoster()
  }, [roster, loadRoster])

  const employees = useMemo(() => {
    if (!roster) return []
    const list = roster.employees.map((e) => ({
      id: e.id,
      name: fullName(e),
      kuerzel: e.kuerzel ?? '',
    }))
    const needle = search.trim().toLowerCase()
    const filtered = needle
      ? list.filter((e) =>
          `${e.name} ${e.kuerzel}`.toLowerCase().includes(needle),
        )
      : list
    return filtered.sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [roster, search])

  const thread = useMemo(() => {
    if (!doc || !activeId) return null
    return doc.threads.find((t) => t.employeeId === activeId) ?? null
  }, [doc, activeId])

  const utteranceCount = (employeeId: string): number =>
    doc?.threads.find((t) => t.employeeId === employeeId)?.utterances.length ?? 0

  const activeEmployee = employees.find((e) => e.id === activeId) ?? null

  if (!doc) return null

  if (!canSwitch) {
    // Single-pane view for employees: just their own thread.
    return (
      <Section
        title="Mein Gespräch"
        subtitle={`Notizen mit deinem Manager · ${myLabel}`}
      >
        {myId ? (
          <ThreadView
            utterances={thread?.utterances ?? []}
            author={myLabel}
            onPost={(text) => postUtterance(myId, myLabel, text)}
            onRemove={(id) => removeUtterance(myId, id)}
            canRemove={(authorLabel) => authorLabel === myLabel}
          />
        ) : (
          <div className="text-sm text-muted-foreground">
            Kein Benutzerkonto erkannt — bitte anmelden, um ein Gespräch zu führen.
          </div>
        )}
      </Section>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        isFullscreen && 'h-screen w-screen overflow-auto bg-background p-4',
      )}
    >
      <div className="mb-3 flex justify-end">
        <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
      </div>
      <div className="grid grid-cols-[280px_1fr] gap-4">
      <aside className="rounded-lg border bg-card">
        <div className="border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              placeholder="Mitarbeiter suchen …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {employees.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {roster === null ? 'Lade Mitarbeiter …' : 'Keine Mitarbeiter gefunden.'}
            </div>
          )}
          {employees.map((e) => {
            const n = utteranceCount(e.id)
            const active = e.id === activeId
            return (
              <button
                key={e.id}
                onClick={() => setActiveId(e.id)}
                className={cn(
                  'flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-sm',
                  active
                    ? 'border-foreground bg-accent/60'
                    : 'border-transparent hover:bg-accent/30',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.name}</div>
                  {e.kuerzel && (
                    <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {e.kuerzel}
                    </div>
                  )}
                </div>
                {n > 0 && (
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {n}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </aside>

      <div>
        {activeId ? (
          <Section
            title={activeEmployee?.name ?? '—'}
            subtitle={
              activeEmployee?.kuerzel
                ? `Gespräch · ${activeEmployee.kuerzel}`
                : 'Gespräch'
            }
          >
            <ThreadView
              utterances={thread?.utterances ?? []}
              author={myLabel}
              onPost={(text) => postUtterance(activeId, myLabel, text)}
              onRemove={(id) => removeUtterance(activeId, id)}
              canRemove={(authorLabel) =>
                authorLabel === myLabel || authorLabel === activeEmployee?.name
              }
            />
          </Section>
        ) : (
          <Section>
            <div className="text-sm text-muted-foreground">
              Mitarbeiter wählen, um ein Gespräch zu öffnen.
            </div>
          </Section>
        )}
      </div>
      </div>
    </div>
  )
}

function ThreadView({
  utterances,
  author,
  onPost,
  onRemove,
  canRemove,
}: {
  utterances: { id: string; ts: string; author: string; text: string }[]
  author: string
  onPost: (text: string) => void
  onRemove: (id: string) => void
  canRemove: (authorLabel: string) => boolean
}) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [utterances.length])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onPost(text)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={listRef} className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
        {utterances.length === 0 && (
          <div className="rounded-md border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
            Noch keine Einträge im Gespräch.
          </div>
        )}
        {utterances.map((u) => {
          const mine = u.author === author
          return (
            <div
              key={u.id}
              className={cn(
                'group rounded-md border px-3 py-2 text-sm',
                mine ? 'border-foreground/20 bg-accent/40' : 'bg-muted/30',
              )}
            >
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-semibold">{u.author}</span>
                <span>·</span>
                <span className="font-mono tabular-nums">{fmtDateTime(u.ts)}</span>
                <div className="flex-1" />
                {canRemove(u.author) && (
                  <button
                    type="button"
                    title="Eintrag löschen"
                    onClick={() => onRemove(u.id)}
                    className="rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="mt-1 whitespace-pre-wrap leading-snug">{u.text}</div>
            </div>
          )
        })}
      </div>

      <div className="flex items-end gap-2 border-t pt-3">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Notiz hinzufügen … (⌘/Strg + Enter zum Senden)"
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <Button onClick={submit} disabled={!draft.trim()}>
          <Send className="mr-1 h-3.5 w-3.5" /> Senden
        </Button>
      </div>
    </div>
  )
}
