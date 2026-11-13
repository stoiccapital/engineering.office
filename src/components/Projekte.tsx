import { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  Flame,
  Plus,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { LoadingCard } from '@/components/ui/loading-card'
import {
  fmtFrist,
  isOverdue,
  myOpenTodoCount,
  useProjects,
  visibleRows,
  type ProjektFilter,
  type ProjektSortCol,
} from '@/projects-store'
import { useAccess } from '@/access-store'
import { useRoster } from '@/roster-store'
import { logActivity } from '@/activity-store'
import {
  PROJEKT_PRIORITY_LABELS,
  PROJEKT_STATUS_LABELS,
  type ProjektPriority,
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

const PRIORITY_CHIP: Record<ProjektPriority, string> = {
  niedrig: 'bg-muted text-muted-foreground border-border',
  mittel: 'bg-sky-100 text-sky-900 border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200',
  hoch: 'bg-amber-100 text-amber-900 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200',
  dringend: 'bg-destructive/15 text-destructive border-destructive/30',
}

const STATUSES: ProjektStatus[] = ['offen', 'inArbeit', 'erledigt', 'blockiert']
const PRIORITIES: ProjektPriority[] = ['niedrig', 'mittel', 'hoch', 'dringend']

const NO_SEL = '— keiner —'

// Permission helpers — single source of truth for the UI.
function perm(row: ProjektRow, myKuerzel: string | null) {
  const my = myKuerzel?.toLowerCase() ?? null
  const isOwner = !!my && row.ownerKuerzel.toLowerCase() === my
  const isPM = !!my && !!row.pmKuerzel && row.pmKuerzel.toLowerCase() === my
  return {
    isOwner,
    isPM,
    // Owner + PM can edit project fields (name, status, PM, team, Frist, priority, description).
    canEdit: isOwner || isPM,
    // Owner + PM can manage todos (add/edit/delete/dispatch).
    canManageTodos: isOwner || isPM,
    // Delete is owner-only.
    canDelete: isOwner,
    // Assignee of a specific todo can toggle it. Owner + PM can toggle any.
    canToggleTodo: (todo: ProjektTodo): boolean => {
      if (isOwner || isPM) return true
      if (!my || !todo.assigneeKuerzel) return false
      return todo.assigneeKuerzel.toLowerCase() === my
    },
  }
}

export function Projekte() {
  const doc = useProjects((s) => s.doc)
  const status = useProjects((s) => s.status)
  const filter = useProjects((s) => s.filter)
  const setFilter = useProjects((s) => s.setFilter)
  const sort = useProjects((s) => s.sort)
  const setSort = useProjects((s) => s.setSort)
  const pendingDeletes = useProjects((s) => s.pendingDeletes)
  const addRow = useProjects((s) => s.addRow)
  const updateRow = useProjects((s) => s.updateRow)
  const softDeleteRow = useProjects((s) => s.softDeleteRow)
  const undoDeleteRow = useProjects((s) => s.undoDeleteRow)
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

  // Lookup kuerzel → full label for tooltips.
  const nameByKuerzel = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of employeeOptions) m.set(e.kuerzel.toLowerCase(), e.label)
    return m
  }, [employeeOptions])

  const shown = useMemo(() => {
    if (!doc) return []
    return visibleRows(doc, myKuerzel, filter, pendingDeletes, sort)
  }, [doc, myKuerzel, filter, pendingDeletes, sort])

  const pending = Object.values(pendingDeletes)

  if (!doc && status === 'loading') return <LoadingCard>Lade Projekte…</LoadingCard>
  if (!doc) return <LoadingCard>Lade Projekte…</LoadingCard>

  const selectedRow = selectedProjectId
    ? doc.rows.find((r) => r.id === selectedProjectId) ?? null
    : null

  const handleCreate = () => {
    if (!myKuerzel) return
    const id = addRow(myKuerzel)
    selectProject(id)
    logActivity({ kind: 'action', action: 'projekt.create' })
  }

  if (selectedRow) {
    return (
      <>
        <ProjektDetail
          row={selectedRow}
          myKuerzel={myKuerzel}
          employeeOptions={employeeOptions}
          nameByKuerzel={nameByKuerzel}
          onBack={() => selectProject(null)}
          onUpdate={(patch) => {
            updateRow(selectedRow.id, patch)
            if (patch.status) {
              logActivity({
                kind: 'action',
                action: 'projekt.status',
                target: `${selectedRow.projekt || '(ohne Titel)'} → ${PROJEKT_STATUS_LABELS[patch.status]}`,
              })
            }
          }}
          onDelete={() => {
            softDeleteRow(selectedRow.id)
            logActivity({
              kind: 'action',
              action: 'projekt.delete',
              target: selectedRow.projekt || '(ohne Titel)',
            })
          }}
          onAddTodo={() => {
            addTodo(selectedRow.id)
            logActivity({ kind: 'action', action: 'todo.add' })
          }}
          onUpdateTodo={(todoId, patch) => {
            updateTodo(selectedRow.id, todoId, patch)
            if (patch.done === true) {
              logActivity({ kind: 'action', action: 'todo.done' })
            } else if (patch.assigneeKuerzel !== undefined) {
              logActivity({
                kind: 'action',
                action: 'todo.assign',
                target: patch.assigneeKuerzel || '(unbekannt)',
              })
            }
          }}
          onRemoveTodo={(todoId) => removeTodo(selectedRow.id, todoId)}
        />
        <UndoToasts pending={pending} onUndo={(id) => undoDeleteRow(id)} />
      </>
    )
  }

  const myNotes = myKuerzel ? doc.notesByUser[myKuerzel] ?? '' : ''

  return (
    <div className="space-y-4">
      <Section
        title="Projekte"
        subtitle={`${shown.length} ${shown.length === 1 ? 'Projekt' : 'Projekte'} · klick auf eine Zeile öffnet Details`}
        padded={false}
        action={
          <div className="flex items-center gap-2">
            <FilterPicker value={filter} onChange={setFilter} />
            <Button size="sm" disabled={!myKuerzel} onClick={handleCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Projekt
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/60">
              <tr className="border-b text-muted-foreground">
                <SortableHeader
                  col="status"
                  label="Status"
                  sort={sort}
                  onSort={setSort}
                  className="w-24"
                />
                <th className="px-3 py-2 text-left font-medium">Projekt</th>
                <SortableHeader
                  col="priority"
                  label="Priorität"
                  sort={sort}
                  onSort={setSort}
                  className="w-24"
                />
                <th className="w-24 px-3 py-2 text-right font-medium">To-dos</th>
                <th className="w-20 px-3 py-2 text-left font-medium">Owner</th>
                <th className="w-20 px-3 py-2 text-left font-medium">PM</th>
                <th className="w-40 px-3 py-2 text-left font-medium">Team</th>
                <SortableHeader
                  col="frist"
                  label="Frist"
                  sort={sort}
                  onSort={setSort}
                  className="w-24"
                />
                <SortableHeader
                  col="updatedAt"
                  label="Geändert"
                  sort={sort}
                  onSort={setSort}
                  className="w-28"
                />
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <div className="text-sm text-muted-foreground">
                      {filter === 'mine'
                        ? 'Du bist in keinem Projekt zugewiesen.'
                        : 'Noch keine Projekte.'}
                    </div>
                    <Button
                      size="sm"
                      className="mt-3"
                      disabled={!myKuerzel}
                      onClick={handleCreate}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Erstes Projekt anlegen
                    </Button>
                  </td>
                </tr>
              ) : (
                shown.map((r) => (
                  <ProjektListRow
                    key={r.id}
                    row={r}
                    myKuerzel={myKuerzel}
                    nameByKuerzel={nameByKuerzel}
                    onOpen={() => selectProject(r.id)}
                    onDelete={() => {
                      softDeleteRow(r.id)
                      logActivity({
                        kind: 'action',
                        action: 'projekt.delete',
                        target: r.projekt || '(ohne Titel)',
                      })
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Notizen"
        subtitle="Persönliche Schreibfläche — im geteilten Projekte-Dokument (sichtbar für Admins mit KV-Zugriff)"
      >
        <textarea
          value={myNotes}
          onChange={(e) => myKuerzel && setMyNotes(myKuerzel, e.target.value)}
          disabled={!myKuerzel}
          placeholder={
            myKuerzel
              ? 'Hier reinschreiben…'
              : 'Mit einem Benutzer anmelden, um Notizen zu speichern.'
          }
          className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </Section>

      <UndoToasts pending={pending} onUndo={(id) => undoDeleteRow(id)} />
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

function SortableHeader({
  col,
  label,
  sort,
  onSort,
  className,
}: {
  col: ProjektSortCol
  label: string
  sort: { col: ProjektSortCol; dir: 'asc' | 'desc' }
  onSort: (s: { col: ProjektSortCol; dir: 'asc' | 'desc' }) => void
  className?: string
}) {
  const active = sort.col === col
  const dir = active ? sort.dir : 'asc'
  const toggle = () => {
    if (!active) onSort({ col, dir: 'asc' })
    else onSort({ col, dir: dir === 'asc' ? 'desc' : 'asc' })
  }
  return (
    <th className={cn('px-3 py-2 text-left font-medium', className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : null}
      </button>
    </th>
  )
}

function ProjektListRow({
  row,
  myKuerzel,
  nameByKuerzel,
  onOpen,
  onDelete,
}: {
  row: ProjektRow
  myKuerzel: string | null
  nameByKuerzel: Map<string, string>
  onOpen: () => void
  onDelete: () => void
}) {
  const p = perm(row, myKuerzel)
  const doneCount = row.todos.filter((t) => t.done).length
  const progress =
    row.todos.length > 0 ? `${doneCount} / ${row.todos.length}` : '–'
  const overdue = isOverdue(row.frist, row.status)
  return (
    <tr
      onClick={onOpen}
      className={cn(
        'group cursor-pointer border-b last:border-b-0 align-middle hover:bg-accent/40',
        row.status === 'erledigt' && 'opacity-60',
      )}
    >
      <td className="px-3 py-2">
        <span
          className={cn(
            'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider',
            STATUS_CHIP[row.status],
          )}
        >
          {PROJEKT_STATUS_LABELS[row.status]}
        </span>
      </td>
      <td className="px-3 py-2">
        <div
          className={cn(
            'text-sm font-medium group-hover:text-foreground',
            row.status === 'erledigt' && 'line-through',
          )}
        >
          {row.projekt || (
            <span className="text-muted-foreground/60">Ohne Titel</span>
          )}
        </div>
        {row.bemerkung && (
          <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
            {row.bemerkung}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium',
            PRIORITY_CHIP[row.priority],
          )}
          title={PROJEKT_PRIORITY_LABELS[row.priority]}
        >
          {row.priority === 'dringend' && <Flame className="h-3 w-3" />}
          {PROJEKT_PRIORITY_LABELS[row.priority]}
        </span>
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {progress}
      </td>
      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
        <KuerzelChip kuerzel={row.ownerKuerzel} nameByKuerzel={nameByKuerzel} />
      </td>
      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
        <KuerzelChip kuerzel={row.pmKuerzel} nameByKuerzel={nameByKuerzel} />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {row.assigneeKuerzels.length === 0 ? (
            <span className="text-[11px] text-muted-foreground/60">—</span>
          ) : (
            row.assigneeKuerzels.map((k) => (
              <KuerzelChip key={k} kuerzel={k} nameByKuerzel={nameByKuerzel} />
            ))
          )}
        </div>
      </td>
      <td
        className={cn(
          'px-3 py-2 text-xs',
          overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
        )}
      >
        {row.frist ? (
          <span className="inline-flex items-center gap-1">
            {overdue && <AlertTriangle className="h-3 w-3" />}
            {fmtFrist(row.frist)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {fmtRelative(row.updatedAt)}
      </td>
      <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
        {p.canDelete ? (
          <button
            onClick={onDelete}
            className="rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            title="Löschen"
            aria-label="Projekt löschen"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        ) : (
          <ChevronRight className="inline h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
        )}
      </td>
    </tr>
  )
}

function ProjektDetail({
  row,
  myKuerzel,
  employeeOptions,
  nameByKuerzel,
  onBack,
  onUpdate,
  onDelete,
  onAddTodo,
  onUpdateTodo,
  onRemoveTodo,
}: {
  row: ProjektRow
  myKuerzel: string | null
  employeeOptions: { kuerzel: string; label: string }[]
  nameByKuerzel: Map<string, string>
  onBack: () => void
  onUpdate: (patch: Partial<ProjektRow>) => void
  onDelete: () => void
  onAddTodo: () => void
  onUpdateTodo: (todoId: string, patch: Partial<ProjektTodo>) => void
  onRemoveTodo: (todoId: string) => void
}) {
  const p = perm(row, myKuerzel)
  const overdue = isOverdue(row.frist, row.status)
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
            disabled={!p.canEdit}
            onChange={(e) =>
              onUpdate({ status: e.target.value as ProjektStatus })
            }
            className={cn(
              'inline-flex items-center rounded border px-2 py-1 text-xs font-medium uppercase tracking-wider',
              STATUS_CHIP[row.status],
              !p.canEdit && 'cursor-not-allowed opacity-70',
            )}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJEKT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {p.canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
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
              disabled={!p.canEdit}
              onChange={(e) => onUpdate({ projekt: e.target.value })}
              placeholder="Projektname"
              className={cn(
                'mt-1 w-full rounded-md border bg-background px-3 py-2 text-base font-medium outline-none focus:ring-1 focus:ring-ring',
                !p.canEdit && 'cursor-not-allowed opacity-70',
              )}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <Field label="Owner">
              <div className="inline-flex items-center rounded bg-muted px-2 py-1 font-mono text-xs font-medium">
                {row.ownerKuerzel || '—'}
              </div>
            </Field>
            <Field label="Project Manager">
              <select
                value={row.pmKuerzel ?? ''}
                disabled={!p.canEdit}
                onChange={(e) =>
                  onUpdate({ pmKuerzel: e.target.value || undefined })
                }
                className={cn(
                  'h-8 w-full rounded-md border border-input bg-background px-2 text-sm',
                  !p.canEdit && 'cursor-not-allowed opacity-70',
                )}
              >
                <option value="">{NO_SEL}</option>
                {employeeOptions.map((emp) => (
                  <option key={emp.kuerzel} value={emp.kuerzel}>
                    {emp.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priorität">
              <select
                value={row.priority}
                disabled={!p.canEdit}
                onChange={(e) =>
                  onUpdate({ priority: e.target.value as ProjektPriority })
                }
                className={cn(
                  'h-8 w-full rounded-md border border-input bg-background px-2 text-sm',
                  !p.canEdit && 'cursor-not-allowed opacity-70',
                )}
              >
                {PRIORITIES.map((pr) => (
                  <option key={pr} value={pr}>
                    {PROJEKT_PRIORITY_LABELS[pr]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Frist">
              <input
                type="date"
                value={isoDate(row.frist)}
                disabled={!p.canEdit}
                onChange={(e) => onUpdate({ frist: e.target.value })}
                className={cn(
                  'h-8 w-full rounded-md border border-input bg-background px-2 text-sm',
                  overdue && 'border-destructive/50 text-destructive',
                  !p.canEdit && 'cursor-not-allowed opacity-70',
                )}
              />
              {overdue && (
                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Überfällig
                </div>
              )}
            </Field>
            <Field label="Angelegt">
              <div className="py-1 text-xs text-muted-foreground">{created}</div>
            </Field>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Team
            </label>
            <div className="mt-1">
              <AssigneePicker
                assignees={row.assigneeKuerzels}
                options={employeeOptions}
                nameByKuerzel={nameByKuerzel}
                readOnly={!p.canEdit}
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
              disabled={!p.canEdit}
              onChange={(e) => onUpdate({ bemerkung: e.target.value })}
              placeholder="Beschreibung, Bemerkungen …"
              className={cn(
                'mt-1 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring',
                !p.canEdit && 'cursor-not-allowed opacity-70',
              )}
            />
          </div>
        </div>
      </Section>

      <Section
        title={`To-dos (${row.todos.length})`}
        subtitle={
          p.canManageTodos
            ? 'Als PM oder Owner neue To-dos anlegen und dem Team zuweisen.'
            : 'Du kannst dir zugewiesene To-dos als erledigt markieren. Anlegen / Zuweisen ist PM / Owner vorbehalten.'
        }
      >
        <TodoList
          todos={row.todos}
          myKuerzel={myKuerzel}
          perm={p}
          employeeOptions={employeeOptions}
          nameByKuerzel={nameByKuerzel}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function TodoList({
  todos,
  myKuerzel,
  perm: p,
  employeeOptions,
  nameByKuerzel,
  onAdd,
  onUpdate,
  onRemove,
}: {
  todos: ProjektTodo[]
  myKuerzel: string | null
  perm: ReturnType<typeof perm>
  employeeOptions: { kuerzel: string; label: string }[]
  nameByKuerzel: Map<string, string>
  onAdd: () => void
  onUpdate: (todoId: string, patch: Partial<ProjektTodo>) => void
  onRemove: (todoId: string) => void
}) {
  const my = myKuerzel?.toLowerCase() ?? null
  return (
    <div className="flex flex-col gap-1">
      {todos.length === 0 && !p.canManageTodos && (
        <span className="px-1 text-[11px] text-muted-foreground/60">
          Keine To-dos
        </span>
      )}
      {todos.length === 0 && p.canManageTodos && (
        <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
          Noch keine To-dos. Drücke unten „+ To-do", um eins hinzuzufügen.
        </div>
      )}
      {todos.map((t) => {
        const isAssignee =
          !!my && !!t.assigneeKuerzel && t.assigneeKuerzel.toLowerCase() === my
        const canToggle = p.canToggleTodo(t)
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
              disabled={!p.canManageTodos}
              placeholder="To-do"
              className={cn(
                'min-w-0 flex-1 rounded bg-transparent px-1.5 py-0.5 text-sm outline-none focus:bg-background',
                t.done && 'text-muted-foreground line-through',
                !p.canManageTodos && 'cursor-default',
                isAssignee && !t.done && 'font-medium',
              )}
            />
            {p.canManageTodos ? (
              <select
                value={t.assigneeKuerzel ?? ''}
                onChange={(e) =>
                  onUpdate(t.id, { assigneeKuerzel: e.target.value || undefined })
                }
                className="h-6 w-24 shrink-0 rounded border border-input bg-background px-1 text-[11px]"
                title="An wen dispatchen"
              >
                <option value="">{NO_SEL}</option>
                {employeeOptions.map((emp) => (
                  <option key={emp.kuerzel} value={emp.kuerzel}>
                    {emp.kuerzel}
                  </option>
                ))}
              </select>
            ) : (
              <KuerzelChip
                kuerzel={t.assigneeKuerzel}
                nameByKuerzel={nameByKuerzel}
              />
            )}
            {p.canManageTodos && (
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
      {p.canManageTodos && (
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
  nameByKuerzel,
  readOnly,
  onChange,
}: {
  assignees: string[]
  options: { kuerzel: string; label: string }[]
  nameByKuerzel: Map<string, string>
  readOnly?: boolean
  onChange: (next: string[]) => void
}) {
  const remaining = options.filter((o) => !assignees.includes(o.kuerzel))
  return (
    <div className="flex flex-wrap items-center gap-1">
      {assignees.map((k) => (
        <span
          key={k}
          title={nameByKuerzel.get(k.toLowerCase())}
          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium"
        >
          {k}
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange(assignees.filter((x) => x !== k))}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`${k} entfernen`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}
      {!readOnly && remaining.length > 0 && (
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

function KuerzelChip({
  kuerzel,
  nameByKuerzel,
}: {
  kuerzel: string | null | undefined
  nameByKuerzel: Map<string, string>
}) {
  if (!kuerzel) return <span className="text-[11px] text-muted-foreground/60">—</span>
  const label = nameByKuerzel.get(kuerzel.toLowerCase())
  return (
    <span
      title={label}
      className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium"
    >
      {kuerzel}
    </span>
  )
}

function UndoToasts({
  pending,
  onUndo,
}: {
  pending: ProjektRow[]
  onUndo: (id: string) => void
}) {
  if (pending.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-2">
      {pending.map((r) => (
        <div
          key={r.id}
          className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-lg"
        >
          <span className="text-sm">
            Projekt{' '}
            <strong className="font-semibold">
              {r.projekt || 'Ohne Titel'}
            </strong>{' '}
            gelöscht
          </span>
          <Button variant="ghost" size="sm" onClick={() => onUndo(r.id)}>
            <Undo2 className="mr-1 h-3.5 w-3.5" />
            Rückgängig
          </Button>
        </div>
      ))}
    </div>
  )
}

function isoDate(input: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : ''
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

function fmtRelative(iso: string): string {
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} min`
    if (diff < day) return `${Math.floor(diff / hour)} h`
    if (diff < 7 * day) return `${Math.floor(diff / day)} d`
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

// Re-export for the sidebar badge count.
export { myOpenTodoCount }
