import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useHr } from '@/hr-store'
import { useAccess } from '@/access-store'
import { useRoster } from '@/roster-store'
import { useProjektliste } from '@/projektliste-store'
import {
  entriesFor,
  isoDate,
  sumStunden,
  weekBounds,
} from '@/features/hr/lib/domain'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { NumCell } from '@/components/NumCell'
import { TextCell } from '@/components/TextCell'
import { cn } from '@/lib/utils'
import type { ModuleId } from '@/types'
import type { ZeitEntry } from '@/features/hr/types'
import { useFullscreen } from '@/components/ui/use-fullscreen'
import { FullscreenToggle } from '@/components/ui/fullscreen-toggle'

const TAG_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

const fmtHours = (v: number): string =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(v)

const fmtDate = (d: Date): string =>
  d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function fullName(e: { vorname: string; name: string; kuerzel?: string }): string {
  const n = [e.vorname, e.name].filter((s) => s.trim().length > 0).join(' ')
  return n || e.kuerzel || '—'
}

export function ZeiterfassungTab() {
  const { ref: containerRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>()
  const doc = useHr((s) => s.doc)
  const addEntry = useHr((s) => s.addEntry)
  const currentUser = useAccess((s) => s.currentUser)
  const currentRole = useAccess((s) => s.currentRole)
  const roster = useRoster((s) => s.roster)
  const loadRoster = useRoster((s) => s.load)
  const projektliste = useProjektliste((s) => s.doc)
  const loadProjektliste = useProjektliste((s) => s.load)

  // Managers can switch employee; everyone else is locked to their own view.
  const canSwitch = useMemo(
    () => (currentRole?.modules as ModuleId[] | undefined)?.includes('hr_team_view') ?? false,
    [currentRole],
  )
  const myId = currentUser?.id ?? ''
  const [activeId, setActiveId] = useState(myId)
  useEffect(() => {
    if (!canSwitch) setActiveId(myId)
  }, [canSwitch, myId])

  // Load dependencies on first open (no-op if already loaded).
  useEffect(() => {
    if (!roster) void loadRoster()
  }, [roster, loadRoster])
  useEffect(() => {
    if (!projektliste) void loadProjektliste()
  }, [projektliste, loadProjektliste])

  const [cursor, setCursor] = useState<Date>(() => new Date())
  const bounds = useMemo(() => weekBounds(cursor), [cursor])
  const weekDays = useMemo(() => {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(bounds.start)
      d.setDate(bounds.start.getDate() + i)
      days.push(d)
    }
    return days
  }, [bounds])

  const weekEntries = useMemo(() => {
    if (!doc) return []
    return entriesFor(doc, activeId || null, {
      start: isoDate(bounds.start),
      end: isoDate(bounds.end),
    })
  }, [doc, activeId, bounds])

  const weekTotal = sumStunden(weekEntries)
  const projekteOptions = useMemo(() => {
    if (!projektliste) return []
    return projektliste.rows.map((r) => ({ id: r.id, name: r.projekt || '—' }))
  }, [projektliste])

  // All roster employees are selectable — kuerzel is a login detail, not a
  // prerequisite for HR tracking.
  const employees = useMemo(() => {
    if (!roster) return []
    return roster.employees
      .map((e) => ({
        id: e.id,
        name: fullName(e),
        kuerzel: e.kuerzel ?? '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [roster])

  const activeEmployee = useMemo(
    () => employees.find((e) => e.id === activeId) ?? null,
    [employees, activeId],
  )

  if (!doc) return null

  const addFor = (day: Date) => {
    if (!activeId) return
    addEntry({
      datum: isoDate(day),
      employeeId: activeId,
      stunden: 0,
      pause: 0,
      notiz: '',
    })
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'space-y-4',
        isFullscreen && 'h-screen w-screen overflow-auto bg-background p-4',
      )}
    >
      <div className="flex justify-end">
        <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
      </div>
      <Section
        padded={false}
        className="bg-card"
        contentClassName="flex flex-wrap items-center gap-3 px-4 py-3"
      >
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCursor(shiftWeek(cursor, -1))}
            title="Vorherige Woche"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] px-2 text-center">
            <div className="font-mono tabular-nums text-sm font-semibold">
              KW {isoWeek(bounds.start)} · {fmtDate(bounds.start)} – {fmtDate(bounds.end)}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCursor(shiftWeek(cursor, 1))}
            title="Nächste Woche"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Heute
          </Button>
        </div>

        {canSwitch && (
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Mitarbeiter
            </label>
            <select
              value={activeId}
              onChange={(e) => setActiveId(e.target.value)}
              className="h-8 min-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
            >
              {myId && !employees.some((e) => e.id === myId) && (
                <option value={myId}>Ich</option>
              )}
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.kuerzel ? ` (${e.kuerzel})` : ''}
                  {e.id === myId ? ' — ich' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1" />
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {activeEmployee ? `${activeEmployee.name} · Woche` : 'Woche gesamt'}
          </div>
          <div className="font-mono tabular-nums text-lg font-semibold">
            {fmtHours(weekTotal)} h
          </div>
        </div>
      </Section>

      {!activeId && (
        <Section>
          <div className="text-sm text-muted-foreground">
            Kein Mitarbeiter ausgewählt.
          </div>
        </Section>
      )}

      {activeId &&
        weekDays.map((day) => {
          const key = isoDate(day)
          const dayEntries = weekEntries.filter((e) => e.datum === key)
          const daySum = sumStunden(dayEntries)
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          return (
            <section
              key={key}
              className={cn('rounded-lg border bg-card', isWeekend && 'opacity-80')}
            >
              <div className="flex items-center gap-3 border-b px-4 py-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">
                    {TAG_LABELS[(day.getDay() + 6) % 7]}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {fmtDate(day)}
                  </span>
                </div>
                <div className="flex-1" />
                <div className="font-mono tabular-nums text-sm">
                  {daySum ? `${fmtHours(daySum)} h` : ''}
                </div>
              </div>
              <div className="p-3">
                {dayEntries.length === 0 ? (
                  <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                    Noch keine Buchung.
                  </div>
                ) : (
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <Th className="w-[280px]">Projekt</Th>
                        <Th className="w-[90px] text-right">Stunden</Th>
                        <Th className="w-[90px] text-right">Pause [h]</Th>
                        <Th>Notiz</Th>
                        <Th className="w-[40px]"></Th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayEntries.map((e) => (
                        <EntryRow
                          key={e.id}
                          entry={e}
                          projekte={projekteOptions}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => addFor(day)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Eintrag
                  </Button>
                </div>
              </div>
            </section>
          )
        })}
    </div>
  )
}

function EntryRow({
  entry,
  projekte,
}: {
  entry: ZeitEntry
  projekte: { id: string; name: string }[]
}) {
  const update = useHr((s) => s.updateEntry)
  const remove = useHr((s) => s.removeEntry)

  const onProjektChange = (id: string) => {
    if (id === '__none') {
      update(entry.id, { projektId: null, projekt: '' })
      return
    }
    const p = projekte.find((p) => p.id === id)
    update(entry.id, { projektId: id, projekt: p?.name ?? entry.projekt })
  }

  return (
    <tr className="group">
      <Td>
        <select
          value={entry.projektId ?? '__none'}
          onChange={(e) => onProjektChange(e.target.value)}
          className="h-8 w-full rounded-sm bg-foreground/[0.03] px-2 text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
        >
          <option value="__none">— ohne Projekt —</option>
          {projekte.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {/* Keep the frozen project name selectable even if the Projektliste
              entry was deleted later — avoids silent loss on display. */}
          {entry.projektId &&
            !projekte.some((p) => p.id === entry.projektId) &&
            entry.projekt && (
              <option value={entry.projektId}>{entry.projekt} (gelöscht)</option>
            )}
        </select>
      </Td>
      <Td className="text-right">
        <NumCell
          value={entry.stunden}
          onChange={(v) => update(entry.id, { stunden: v ?? 0 })}
          decimals={2}
        />
      </Td>
      <Td className="text-right">
        <NumCell
          value={entry.pause}
          onChange={(v) => update(entry.id, { pause: v ?? 0 })}
          decimals={2}
        />
      </Td>
      <Td>
        <TextCell
          value={entry.notiz}
          onChange={(v) => update(entry.id, { notiz: v })}
          placeholder="Tätigkeit, Besprechung, etc."
          multiline
        />
      </Td>
      <Td>
        <div className="flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title="Löschen"
            onClick={() => remove(entry.id)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </Td>
    </tr>
  )
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('border-b px-2 pb-2 text-left font-medium', className)}>{children}</th>
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('align-top py-1', className)}>{children}</td>
}

function shiftWeek(d: Date, deltaWeeks: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + deltaWeeks * 7)
  return next
}
