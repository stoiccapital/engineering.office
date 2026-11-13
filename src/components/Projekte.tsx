import { useMemo } from 'react'
import { ArrowLeft, Check, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { LoadingCard } from '@/components/ui/loading-card'
import { useProjects, visibleRows, type ProjektFilter } from '@/projects-store'
import { useAccess } from '@/access-store'
import { useRoster } from '@/roster-store'
import {
  PROJEKT_STATUS_LABELS,
  type ProjektRow,
  type ProjektStatus,
  type ProjektTodo,
} from '@/types'
import { cn } from '@/lib/utils'

const STATUS_CHIP: Record<ProjektStatus, string> = {
  offen: 'bg-sky-100 text-sky-900 border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200',
  inArbeit: 'bg-amber-100 text-amber-900 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200',
  erledigt: 'bg-emerald-100 text-emerald-900 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200',
  blockiert: 'bg-destructive/15 text-destructive border-destructive/30',
}

const STATUSES: ProjektStatus[] = ['offen', 'inArbeit', 'erledigt', 'blockiert']

export function Projekte() {
  const doc = useProjects((s) => s.doc)
  const status = useProjects((s) => s.status)
  const filter = useProjects((s) => s.filter)
  const setFilter = useProjects((s) => s.setFilter)
  const addRow = useProjects((s) => s.addRow)
  const updateRow = useProjects((s) => s.updateRow)
  const removeRow = useProjects((s) => s.removeRow)
  const addTodo = useProjects((s) => s.addTodo)
  const updateTodo = useProjects((s) => s.updateTodo)
  const removeTodo = useProjects((s) => s.removeTodo)
  const setMyNotes = useProjects((s) => s.setMyNotes)
  const selectedProjectId = useProjects((s) => s.selectedProjectId)
  const selectProject = useProjects((s) => s.selectProject)

  const currentUser = useAccess((s) => s.currentUser)
  const currentRole = useAccess((s) => s.currentRole)
  const roster = useRoster((s) => s.roster)
  const loadRoster = useRoster((s) => s.load)

  useMemo(() => {
    if (!roster) void loadRoster()
  }, [roster, loadRoster])

  // Prefer the real user's kuerzel; fall back to the role name so a role-only
  // login (e.g. the dev mock admin) can still create and own projects.
  const myKuerzel = currentUser?.kuerzel ?? currentRole?.name ?? null

  const employeeOptions = useMemo(() => {
    const list = (roster?.employees ?? [])
      .filter((e) => e.kuerzel)
      .map((e) => ({
        kuerzel: e.kuerzel as string,
        label: `${e.kuerzel}${e.vorname || e.name ? ` · ${[e.vorname, e.name].filter(Boolean).join(' ')}` : ''}`,
      }))
    list.sort((a, b) => a.kuerzel.localeCompare(b.kuerzel))
    return list
  }, [roster])

  const shown = useMemo(() => {
    if (!doc) return []
    return visibleRows(doc, myKuerzel, filter)
  }, [doc, myKuerzel, filter])

  if (!doc && status === 'loading') return <LoadingCard>Lade Projekte…</LoadingCard>
  if (!doc) return <LoadingCard>Lade Projekte…</LoadingCard>

  const selectedRow = selectedProjectId
    ? doc.rows.find((r) => r.id === selectedProjectId) ?? null
    : null

  if (selectedRow) {
    return (
      <ProjektDetail
        row={selectedRow}
        myKuerzel={myKuerzel}
        employeeOptions={employeeOptions}
        onBack={() => selectProject(null)}
        onUpdate={(patch) => updateRow(selectedRow.id, patch)}
        onRemove={() => {
          removeRow(selectedRow.id)
          selectProject(null)
        }}
        onAddTodo={() => addTodo(selectedRow.id)}
        onUpdateTodo={(todoId, patch) => updateTodo(selectedRow.id, todoId, patch)}
        onRemoveTodo={(todoId) => removeTodo(selectedRow.id, todoId)}
      />
    )
  }

  const myNotes = myKuerzel ? doc.notesByUser[myKuerzel] ?? '' : ''

  return (
    <div className="space-y-4">
      <Section
        title="Projekte"
        subtitle="Projekt- und To-do-Liste mit Owner, PM und Team"
        padded={false}
        action={
          <div className="flex items-center gap-2">
            <FilterPicker value={filter} onChange={setFilter} />
            <Button
              size="sm"
              disabled={!myKuerzel}
              onClick={() => myKuerzel && addRow(myKuerzel)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Projekt
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/60">
              <tr className="border-b text-muted-foreground">
                <th className="w-24 px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Projekt</th>
                <th className="w-24 px-3 py-2 text-right font-medium">To-dos</th>
                <th className="w-20 px-3 py-2 text-left font-medium">Owner</th>
                <th className="w-20 px-3 py-2 text-left font-medium">PM</th>
                <th className="w-40 px-3 py-2 text-left font-medium">Team</th>
                <th className="w-24 px-3 py-2 text-left font-medium">Frist</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-xs text-muted-foreground"
                  >
                    {filter === 'mine'
                      ? 'Du bist in keinem Projekt zugewiesen. „+ Zeile" drücken, um eins anzulegen.'
                      : 'Noch keine Projekte.'}
                  </td>
                </tr>
              ) : (
                shown.map((r) => (
                  <ProjektListRow
                    key={r.id}
                    row={r}
                    onOpen={() => selectProject(r.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Freie Schreibfläche"
        subtitle="Persönliche Notizen — nur für dich sichtbar"
      >
        <textarea
          value={myNotes}
          onChange={(e) => myKuerzel && setMyNotes(myKuerzel, e.target.value)}
          disabled={!myKuerzel}
          placeholder={
            myKuerzel
              ? 'Hier reinschreiben…'
              : 'Mit einem Benutzer anmelden, um persönliche Notizen zu speichern.'
          }
          className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </Section>
    </div>
  )
}

function FilterPicker({
  value,
  onChange,
}: {
  value: ProjektFilter
  onChange: (f: ProjektFilter) => void
}) {
  return (
    <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
      {(['mine', 'all'] as ProjektFilter[]).map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={cn(
            'rounded px-2.5 py-1 font-medium transition-colors',
            value === f
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {f === 'mine' ? 'Meine' : 'Alle'}
        </button>
      ))}
    </div>
  )
}

function ProjektListRow({
  row,
  onOpen,
}: {
  row: ProjektRow
  onOpen: () => void
}) {
  const doneCount = row.todos.filter((t) => t.done).length
  const todoProgress = row.todos.length > 0 ? `${doneCount} / ${row.todos.length}` : '–'
  return (
    <tr
      onClick={onOpen}
      className="group cursor-pointer border-b last:border-b-0 align-middle hover:bg-accent/40"
    >
      <td className="px-3 py-2">
        <span
          className={cn(
            'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
            STATUS_CHIP[row.status],
          )}
        >
          {PROJEKT_STATUS_LABELS[row.status]}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="text-sm font-medium">
          {row.projekt || <span className="text-muted-foreground/60">Ohne Titel</span>}
        </div>
        {row.bemerkung && (
          <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
            {row.bemerkung}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {todoProgress}
      </td>
      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
        {row.ownerKuerzel || '—'}
      </td>
      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
        {row.pmKuerzel || '—'}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {row.assigneeKuerzels.length === 0 ? (
            <span className="text-[11px] text-muted-foreground/60">—</span>
          ) : (
            row.assigneeKuerzels.map((k) => (
              <span
                key={k}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium"
              >
                {k}
              </span>
            ))
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {row.frist || '—'}
      </td>
      <td className="px-2 py-2 text-right">
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
      </td>
    </tr>
  )
}

function ProjektDetail({
  row,
  myKuerzel,
  employeeOptions,
  onBack,
  onUpdate,
  onRemove,
  onAddTodo,
  onUpdateTodo,
  onRemoveTodo,
}: {
  row: ProjektRow
  myKuerzel: string | null
  employeeOptions: { kuerzel: string; label: string }[]
  onBack: () => void
  onUpdate: (patch: Partial<ProjektRow>) => void
  onRemove: () => void
  onAddTodo: () => void
  onUpdateTodo: (todoId: string, patch: Partial<ProjektTodo>) => void
  onRemoveTodo: (todoId: string) => void
}) {
  const my = myKuerzel?.toLowerCase() ?? null
  const isOwner = !!my && row.ownerKuerzel.toLowerCase() === my
  const isPM = !!my && !!row.pmKuerzel && row.pmKuerzel.toLowerCase() === my
  const canManageTodos = isOwner || isPM

  const created = fmtDateTime(row.createdAt)
  const updated = fmtDateTime(row.updatedAt)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Zurück zur Liste
        </Button>
        <div className="flex items-center gap-2">
          <select
            value={row.status}
            onChange={(e) =>
              onUpdate({ status: e.target.value as ProjektStatus })
            }
            className={cn(
              'inline-flex items-center rounded border px-2 py-1 text-xs font-medium uppercase tracking-wider',
              STATUS_CHIP[row.status],
            )}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJEKT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Löschen
            </Button>
          )}
        </div>
      </div>

      <Section padded>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Projekt
            </label>
            <input
              value={row.projekt}
              onChange={(e) => onUpdate({ projekt: e.target.value })}
              placeholder="Projektname"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-base font-medium outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Owner
              </label>
              <div className="mt-1 inline-flex items-center rounded bg-muted px-2 py-1 font-mono text-xs font-medium">
                {row.ownerKuerzel || '—'}
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Project Manager
              </label>
              <select
                value={row.pmKuerzel ?? ''}
                onChange={(e) => onUpdate({ pmKuerzel: e.target.value || undefined })}
                className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">— kein PM —</option>
                {employeeOptions.map((emp) => (
                  <option key={emp.kuerzel} value={emp.kuerzel}>
                    {emp.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Frist
              </label>
              <input
                value={row.frist}
                onChange={(e) => onUpdate({ frist: e.target.value })}
                placeholder="z. B. 15.12."
                className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Angelegt
              </label>
              <div className="mt-1 py-1 text-xs text-muted-foreground">
                {created}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Team
            </label>
            <div className="mt-1">
              <AssigneePicker
                assignees={row.assigneeKuerzels}
                options={employeeOptions}
                onChange={(assigneeKuerzels) => onUpdate({ assigneeKuerzels })}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Beschreibung / Bemerkung
            </label>
            <textarea
              value={row.bemerkung}
              onChange={(e) => onUpdate({ bemerkung: e.target.value })}
              placeholder="Beschreibung, Bemerkungen …"
              className="mt-1 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </Section>

      <Section
        title={`To-dos (${row.todos.length})`}
        subtitle={
          canManageTodos
            ? 'Als PM oder Owner neue To-dos anlegen und dem Team zuweisen.'
            : 'Nur der PM oder Owner darf neue To-dos anlegen. Du kannst dir zugewiesene To-dos als erledigt markieren.'
        }
      >
        <TodoList
          todos={row.todos}
          myKuerzel={my}
          canManage={canManageTodos}
          employeeOptions={employeeOptions}
          onAdd={onAddTodo}
          onUpdate={onUpdateTodo}
          onRemove={onRemoveTodo}
        />
      </Section>

      <div className="px-2 text-[11px] text-muted-foreground">
        Zuletzt geändert: {updated}
      </div>
    </div>
  )
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function TodoList({
  todos,
  myKuerzel,
  canManage,
  employeeOptions,
  onAdd,
  onUpdate,
  onRemove,
}: {
  todos: ProjektTodo[]
  myKuerzel: string | null
  canManage: boolean
  employeeOptions: { kuerzel: string; label: string }[]
  onAdd: () => void
  onUpdate: (todoId: string, patch: Partial<ProjektTodo>) => void
  onRemove: (todoId: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      {todos.length === 0 && !canManage && (
        <span className="px-1 text-[11px] text-muted-foreground/60">
          Keine To-dos
        </span>
      )}
      {todos.map((t) => {
        const isAssignee =
          !!myKuerzel && !!t.assigneeKuerzel && t.assigneeKuerzel.toLowerCase() === myKuerzel
        const canToggle = canManage || isAssignee
        return (
          <div
            key={t.id}
            className="group/t flex items-start gap-1.5 rounded px-1 py-0.5 hover:bg-accent/40"
          >
            <button
              type="button"
              disabled={!canToggle}
              onClick={() => onUpdate(t.id, { done: !t.done })}
              className={cn(
                'mt-1 h-3.5 w-3.5 shrink-0 rounded border transition-colors',
                t.done
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-input hover:border-foreground/40',
                !canToggle && 'cursor-not-allowed opacity-50',
              )}
              aria-label={t.done ? 'Als offen markieren' : 'Als erledigt markieren'}
              title={
                canToggle
                  ? t.done
                    ? 'Als offen markieren'
                    : 'Als erledigt markieren'
                  : 'Nur PM / Owner oder die zugewiesene Person kann erledigen'
              }
            >
              {t.done && <Check className="h-3 w-3" />}
            </button>
            <input
              value={t.text}
              onChange={(e) => onUpdate(t.id, { text: e.target.value })}
              disabled={!canManage}
              placeholder="To-do"
              className={cn(
                'min-w-0 flex-1 rounded bg-transparent px-1.5 py-0.5 text-sm outline-none focus:bg-background',
                t.done && 'text-muted-foreground line-through',
                !canManage && 'cursor-default',
              )}
            />
            {canManage ? (
              <select
                value={t.assigneeKuerzel ?? ''}
                onChange={(e) =>
                  onUpdate(t.id, { assigneeKuerzel: e.target.value || undefined })
                }
                className="h-6 w-20 shrink-0 rounded border border-input bg-background px-1 text-[11px]"
                title="An wen dispatchen"
              >
                <option value="">— zuweisen —</option>
                {employeeOptions.map((emp) => (
                  <option key={emp.kuerzel} value={emp.kuerzel}>
                    {emp.kuerzel}
                  </option>
                ))}
              </select>
            ) : (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {t.assigneeKuerzel || '—'}
              </span>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => onRemove(t.id)}
                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/t:opacity-100"
                aria-label="To-do löschen"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )
      })}
      {canManage && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 self-start rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          title="To-do hinzufügen"
        >
          <Plus className="h-3 w-3" /> To-do
        </button>
      )}
    </div>
  )
}

function AssigneePicker({
  assignees,
  options,
  onChange,
}: {
  assignees: string[]
  options: { kuerzel: string; label: string }[]
  onChange: (next: string[]) => void
}) {
  const remaining = options.filter((o) => !assignees.includes(o.kuerzel))
  return (
    <div className="flex flex-wrap items-center gap-1">
      {assignees.map((k) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium"
        >
          {k}
          <button
            type="button"
            onClick={() => onChange(assignees.filter((x) => x !== k))}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`${k} entfernen`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {remaining.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...assignees, e.target.value])
          }}
          className="h-6 w-20 rounded border border-input bg-background px-1 text-[11px]"
        >
          <option value="">+ hinzu</option>
          {remaining.map((o) => (
            <option key={o.kuerzel} value={o.kuerzel}>
              {o.kuerzel}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
