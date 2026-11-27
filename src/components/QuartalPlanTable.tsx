import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { usePlan, cellKey, type TeamFilter } from '@/plan-store'
import { useProjektliste } from '@/projektliste-store'
import { useRoster } from '@/roster-store'
import type { Roster, RosterEmployee } from '@/types'
import { useForecast } from '@/store'
import {
  type Branch,
  type Employee,
  type PoolTask,
  type ProjectRow,
  type WeekTodo,
} from '@/types'
import {
  MONTH_LABELS_DE,
  currentISOWeek,
  monthOfISOWeek,
  quarterOfISOWeek,
  weeksInISOYear,
} from '@/lib/iso-week'
import { cn } from '@/lib/utils'
import { ArrowRightLeft, ChevronDown, ChevronRight, Flame, GripVertical, Plus, X } from 'lucide-react'
import { useFullscreen } from '@/components/ui/use-fullscreen'
import { FullscreenToggle } from '@/components/ui/fullscreen-toggle'
import { Section } from '@/components/ui/section'
import { AlwaysOnScrollbar } from '@/components/ui/always-on-scrollbar'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Num } from '@/components/ui/num'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type TodoTone = 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'orange' | null

export function todoTone(text: string): TodoTone {
  const t = text.toLowerCase()
  if (t.includes('aufgabe')) return 'red'
  if (t.includes('abgabe')) return 'green'
  if (t.includes('abstimmen')) return 'yellow'
  if (t.includes('urlaub')) return 'blue'
  // "Mobiles Arbeiten" is the new label; older plans still reference
  // "home office" so we keep both keywords to preserve existing data.
  if (
    t.includes('mobiles arbeiten') ||
    t.includes('mobile') ||
    t.includes('home office') ||
    t.includes('homeoffice')
  )
    return 'orange'
  if (t.includes('pufferarbeiten')) return 'purple'
  return null
}

export const TONE_CLASSES: Record<Exclude<TodoTone, null>, string> = {
  red: 'text-destructive border-l-2 border-destructive pl-1.5 bg-destructive/10',
  green: 'text-success border-l-2 border-success pl-1.5',
  yellow: 'text-warning border-l-2 border-warning pl-1.5',
  blue: 'text-info border-l-2 border-info pl-1.5',
  // orange/purple: keine Token – Produktentscheidung offen (siehe docs/audits/2026-11-27-ui.md)
  orange: 'text-orange-600 border-l-2 border-orange-500 pl-1.5',
  purple: 'text-violet-600 border-l-2 border-violet-500 pl-1.5',
}

export const URLAUB_DAYS_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'] as const

const LEGEND_CLASSES: Record<Exclude<TodoTone, null>, string> = {
  red: 'text-destructive border-l-2 border-destructive',
  green: 'text-success border-l-2 border-success',
  yellow: 'text-warning border-l-2 border-warning',
  blue: 'text-info border-l-2 border-info',
  orange: 'text-orange-600 border-l-2 border-orange-500',
  purple: 'text-violet-600 border-l-2 border-violet-500',
}

// Day-picker color themes per tone — reused by both Urlaub and Mobiles Arbeiten.
const DAY_PICKER_THEMES: Record<'blue' | 'orange', { on: string; hover: string }> = {
  blue: { on: 'bg-sky-100 text-sky-900', hover: 'hover:bg-sky-50 hover:text-sky-900' },
  orange: { on: 'bg-orange-100 text-orange-900', hover: 'hover:bg-orange-50 hover:text-orange-900' },
}

const DAYS_LABELS = URLAUB_DAYS_LABELS

export function QuartalPlanTable() {
  const year = usePlan((s) => s.year)
  const quarter = usePlan((s) => s.quarter)
  const teamFilter = usePlan((s) => s.teamFilter)
  const setTeamFilter = usePlan((s) => s.setTeamFilter)
  const plan = usePlan((s) => s.plan)
  const renameEmployee = usePlan((s) => s.renameEmployee)
  const addEmployee = usePlan((s) => s.addEmployee)
  const removeEmployee = usePlan((s) => s.removeEmployee)
  const addTodo = usePlan((s) => s.addTodo)
  const updateTodo = usePlan((s) => s.updateTodo)
  const removeTodo = usePlan((s) => s.removeTodo)
  const addPoolTask = usePlan((s) => s.addPoolTask)
  const updatePoolTask = usePlan((s) => s.updatePoolTask)
  const removePoolTask = usePlan((s) => s.removePoolTask)
  const assignPoolTask = usePlan((s) => s.assignPoolTask)
  const addRosterEmployee = usePlan((s) => s.addRosterEmployee)
  const moveTodo = usePlan((s) => s.moveTodo)
  const moveAllTodos = usePlan((s) => s.moveAllTodos)

  // Drag-and-drop sensors: pointer requires 4 px travel so a plain click on
  // a todo textarea still edits text instead of starting a drag.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = active.data.current as { empIndex: number; week: number } | undefined
    const to = over.data.current as { empIndex: number; week: number } | undefined
    if (!from || !to) return
    const toKey = cellKey(to.empIndex, to.week)
    const toList = plan?.todos?.[toKey] ?? []
    const overId = String(over.id)
    const idx = toList.findIndex((t) => t.id === overId)
    const toIndex = idx >= 0 ? idx : toList.length
    moveTodo(from, to, String(active.id), toIndex)
  }

  const roster = useRoster((s) => s.roster)
  const loadRoster = useRoster((s) => s.load)
  useEffect(() => {
    if (!roster) void loadRoster()
  }, [roster, loadRoster])

  // Auto-sync: every roster employee not yet linked in the plan gets added.
  // Legacy manually-added employees (no rosterEmployeeId) are untouched.
  // Dismissed ids (explicitly removed from the plan) are skipped so removal
  // sticks until the user re-adds them via "Aus Roster".
  useEffect(() => {
    if (!plan || !roster) return
    const linked = new Set(
      plan.employees.map((e) => e.rosterEmployeeId).filter((id): id is string => !!id),
    )
    const dismissed = new Set(plan.dismissedRosterEmployeeIds ?? [])
    for (const r of roster.employees) {
      if (linked.has(r.id) || dismissed.has(r.id)) continue
      const display =
        [r.vorname, r.name].filter((s) => s.trim().length > 0).join(' ') || 'Unbenannt'
      addRosterEmployee(r.id, display, branchForRosterEmployee(r, roster))
    }
  }, [plan, roster, addRosterEmployee])

  const [assignFor, setAssignFor] = useState<PoolTask | null>(null)
  const [rosterPickerOpen, setRosterPickerOpen] = useState(false)
  const [moveAllFromIndex, setMoveAllFromIndex] = useState<number | null>(null)

  const forecastPeriod = useForecast((s) => s.period)
  const forecastYear = useForecast((s) => s.year)
  const forecastQuarter = useForecast((s) => s.quarter)

  const weekRows = useMemo(() => {
    const total = weeksInISOYear(year)
    const all: { week: number; month: number }[] = []
    for (let w = 1; w <= total; w++) {
      all.push({ week: w, month: monthOfISOWeek(year, w) })
    }
    const filtered =
      quarter === 'all' ? all : all.filter((r) => quarterOfISOWeek(year, r.week) === quarter)
    const rows = filtered.map((r) => ({ ...r, firstOfMonth: false, monthSpan: 0 }))
    let i = 0
    while (i < rows.length) {
      let j = i
      while (j < rows.length && rows[j].month === rows[i].month) j++
      rows[i].firstOfMonth = true
      rows[i].monthSpan = j - i
      i = j
    }
    return rows
  }, [year, quarter])

  const todayWeek = useMemo(() => {
    const t = currentISOWeek()
    return t.year === year ? t.week : null
  }, [year])

  const { ref: containerRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>()
  const scrollRef = useRef<HTMLDivElement>(null)

  if (!plan) return null

  // Keep original indices so cell/todo keys stay stable, but group by
  // roster location for layout. Legacy employees (no roster link) fall
  // back to a group labeled by their branch letter.
  const indexed: { emp: Employee; empIndex: number }[] = plan.employees.map((emp, i) => ({ emp, empIndex: i }))
  // Apply team filter: when a roster team id is picked, keep only employees
  // whose roster-linked team matches. Legacy (unlinked) rows are filtered out
  // because they have no team to match against.
  const filtered = indexed.filter((entry) => {
    if (teamFilter === 'all') return true
    const linkId = entry.emp.rosterEmployeeId
    if (!linkId || !roster) return false
    const rosterEmp = roster.employees.find((r) => r.id === linkId)
    return rosterEmp?.teamId === teamFilter
  })
  const groups = buildPlanGroups(filtered, roster)

  const prioRows = forecastPeriod?.rows.filter((r) => r.prio) ?? []

  const todoCount = plan.todos
    ? Object.values(plan.todos).reduce((sum, list) => sum + list.length, 0)
    : 0
  const title = (
    <>
      {quarter === 'all' ? 'Jahresplan ' : <><Num>{quarter}</Num>{' '}</>}
      <Num>{year}</Num>
    </>
  )
  const subtitle = (
    <>
      <Num>{plan.employees.length}</Num> Mitarbeiter ·{' '}
      <Num>{weekRows.length}</Num> Wochen · <Num>{todoCount}</Num> Aufgaben
    </>
  )

  return (
    <div
      ref={containerRef}
      className={cn(isFullscreen && 'flex h-screen w-screen flex-col bg-background p-4')}
    >
      <DndContext sensors={dndSensors} onDragEnd={onDragEnd}>
      <Section
        title={title}
        subtitle={subtitle}
        padded={false}
        className={cn(isFullscreen && 'flex min-h-0 flex-1 flex-col')}
        contentClassName={cn(isFullscreen && 'flex min-h-0 flex-1 flex-col')}
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRosterPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Mitarbeiter aus Mitarbeiter-Modul hinzufügen"
            >
              <Plus className="h-3.5 w-3.5" />
              Aus Roster
            </button>
            <TeamFilterToggle value={teamFilter} onChange={setTeamFilter} />
            <PlanLegend />
            <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
          </div>
        }
      >
        {prioRows.length > 0 && (
          <PrioStrip
            rows={prioRows}
            forecastLabel={`${forecastQuarter} ${forecastYear}`}
          />
        )}
        <div
          ref={scrollRef}
          className={cn(
            // Native horizontal scrollbar is hidden; the custom overlay below
            // provides a persistently-visible drag target. Vertical native
            // scrollbar stays — its fade-on-idle behaviour is standard.
            'scroll-no-native-h overflow-x-scroll overflow-y-auto',
            // Cap to a viewport-height box when NOT in fullscreen so the
            // horizontal scrollbar sits near the viewport bottom instead of
            // forcing users to page-scroll to find it.
            isFullscreen ? 'min-h-0 flex-1' : 'max-h-[calc(100vh-240px)]',
          )}
        >
          <table className="w-full border-collapse text-xs">
            {/* Pin Monat + KW column widths so sticky left offsets line up
                exactly with the column edges — prevents the horizontal gap
                between the two left-pinned columns during horizontal scroll. */}
            <colgroup>
              <col style={{ width: 64 }} />
              <col style={{ width: 56 }} />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-muted">
              {/* Team label row */}
              <tr className="border-b">
                <th className="sticky left-0 z-30 bg-muted" colSpan={2}></th>
                {groups.map((g, gi) => (
                  <th
                    key={g.key}
                    colSpan={Math.max(1, g.items.length) + 1}
                    className={cn(
                      'px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
                      gi > 0 && 'border-l-2 border-foreground/40',
                    )}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b">
                <th
                  className="sticky left-0 z-30 border-r bg-muted px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                  style={{ width: 64, minWidth: 64, maxWidth: 64 }}
                >
                  Monat
                </th>
                <th
                  className="sticky z-30 border-r bg-muted px-2 py-2 text-right text-xs font-medium text-muted-foreground"
                  style={{ left: 63, width: 56, minWidth: 56, maxWidth: 56 }}
                >
                  KW
                </th>
                {groups.map((g, gi) => (
                  <Fragment key={`th-${g.key}`}>
                    {g.items.map(({ emp, empIndex }, i) => {
                      const link = rosterLinkFor(emp, roster)
                      return (
                        <th
                          key={emp.id}
                          className={cn(
                            'min-w-[280px] px-2 py-2 text-left text-xs font-medium text-muted-foreground',
                            i === 0 && gi > 0 ? 'border-l-2 border-foreground/40' : 'border-l border-foreground/30',
                          )}
                        >
                          <div className="group flex items-center gap-1">
                            {link ? (
                              <div
                                className="flex min-w-0 flex-1 flex-col"
                                title={link.contextLabel}
                              >
                                <span className="truncate text-sm font-semibold text-foreground">
                                  {link.displayName}
                                </span>
                                <span className="truncate font-mono text-[10px] text-muted-foreground">
                                  {link.contextLabel}
                                </span>
                              </div>
                            ) : (
                              <input
                                value={emp.name}
                                onChange={(e) => renameEmployee(empIndex, e.target.value)}
                                className="w-full rounded bg-foreground/[0.03] px-1 py-0.5 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
                              />
                            )}
                            <button
                              onClick={() => setMoveAllFromIndex(empIndex)}
                              className="opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                              title="Alle Aufgaben auf anderen Mitarbeiter übertragen"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </button>
                            {!link && (
                              <button
                                onClick={() => removeEmployee(empIndex)}
                                className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                title="Mitarbeiter aus Plan entfernen"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </th>
                      )
                    })}
                    <th
                      key={`add-${g.key}`}
                      className={cn(
                        'w-10 px-1 py-2',
                        g.items.length === 0 && gi > 0 ? 'border-l-2 border-foreground/40' : 'border-l border-foreground/30',
                      )}
                    >
                      <button
                        onClick={() => addEmployee(g.branch)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title={`Mitarbeiter zu ${g.label} hinzufügen`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekRows.map((row) => {
                const isToday = row.week === todayWeek
                const isPast = isWeekPast(year, row.week)
                return (
                  <tr
                    key={row.week}
                    className={cn('border-b last:border-b-0', isToday && 'bg-primary/5', isPast && 'bg-muted/40')}
                  >
                    <td
                      className={cn(
                        'sticky left-0 z-10 border-r bg-muted px-2 py-1 align-top text-xs font-semibold text-muted-foreground',
                        // Hide the top border on consecutive same-month rows
                        // so the monthly block reads as one merged region.
                        !row.firstOfMonth && 'border-t-0',
                      )}
                      style={{ width: 64, minWidth: 64, maxWidth: 64 }}
                    >
                      {row.firstOfMonth ? MONTH_LABELS_DE[row.month] : ''}
                    </td>
                    <td
                      className={cn(
                        'num sticky z-10 border-r bg-background px-2 py-1 text-xs tabular-nums',
                        isToday ? 'font-semibold text-foreground' : 'text-muted-foreground',
                        isPast && 'bg-muted/40 text-muted-foreground/60',
                      )}
                      style={{ left: 63, width: 56, minWidth: 56, maxWidth: 56 }}
                    >
                      {row.week}
                      <WeekCarryBadge plan={plan} week={row.week} />
                    </td>
                    {groups.map((g, gi) => (
                      <Fragment key={`row-${row.week}-${g.key}`}>
                        {g.items.map(({ emp, empIndex }, i) => {
                          const key = cellKey(empIndex, row.week)
                          const todos = plan.todos?.[key] ?? []
                          const cellEmpty = todos.length === 0 && !isPast
                          return (
                            <td
                              key={emp.id}
                              className={cn(
                                'min-w-[280px] p-0 align-top',
                                i === 0 && gi > 0 ? 'border-l-2 border-foreground/40' : 'border-l border-foreground/30',
                                isPast && 'pointer-events-none opacity-60',
                                cellEmpty && 'bg-danger-soft/60',
                              )}
                            >
                              <WeekTodosCell
                                todos={todos}
                                empIndex={empIndex}
                                week={row.week}
                                locked={isPast}
                                onAdd={() => addTodo(empIndex, row.week)}
                                onUpdate={(id, patch) => updateTodo(empIndex, row.week, id, patch)}
                                onRemove={(id) => removeTodo(empIndex, row.week, id)}
                              />
                            </td>
                          )
                        })}
                        <td
                          className={cn(
                            'align-top',
                            g.items.length === 0 && gi > 0 ? 'border-l-2 border-foreground/40' : 'border-l border-foreground/30',
                          )}
                        />
                      </Fragment>
                    ))}
                  </tr>
                )
              })}
              <PoolRow
                pool={plan.pool ?? []}
                groups={groups}
                onAdd={(empIndex) => addPoolTask(empIndex, '')}
                onUpdate={updatePoolTask}
                onRemove={removePoolTask}
                onAssign={(task) => setAssignFor(task)}
              />
            </tbody>
          </table>
        </div>
        <div className="border-t bg-background px-2 py-1.5">
          <AlwaysOnScrollbar targetRef={scrollRef} />
        </div>
      </Section>
      </DndContext>

      <AssignDialog
        task={assignFor}
        employees={plan.employees}
        year={year}
        onCancel={() => setAssignFor(null)}
        onConfirm={(week) => {
          if (assignFor) assignPoolTask(assignFor.id, week)
          setAssignFor(null)
        }}
      />

      <MoveAllTodosDialog
        fromEmpIndex={moveAllFromIndex}
        employees={plan.employees}
        roster={roster}
        onCancel={() => setMoveAllFromIndex(null)}
        onConfirm={(toEmpIndex) => {
          if (moveAllFromIndex !== null) moveAllTodos(moveAllFromIndex, toEmpIndex)
          setMoveAllFromIndex(null)
        }}
      />

      <RosterPickerDialog
        open={rosterPickerOpen}
        onClose={() => setRosterPickerOpen(false)}
        roster={roster}
        linkedIds={
          new Set(
            plan.employees
              .map((e) => e.rosterEmployeeId)
              .filter((id): id is string => !!id),
          )
        }
        onPick={(r) => {
          const display =
            [r.vorname, r.name].filter((s) => s.trim().length > 0).join(' ') || 'Unbenannt'
          addRosterEmployee(r.id, display, branchForRosterEmployee(r, roster))
        }}
        onPickAll={(list) => {
          for (const r of list) {
            const display =
              [r.vorname, r.name].filter((s) => s.trim().length > 0).join(' ') || 'Unbenannt'
            addRosterEmployee(r.id, display, branchForRosterEmployee(r, roster))
          }
        }}
      />
    </div>
  )
}

// Pool row at the bottom of the week grid — one cell per employee, same
// layout as the week rows. PMs draft tasks per employee; assigning only asks
// for the KW because the employee is implicit from the column.
function PoolRow({
  pool,
  groups,
  onAdd,
  onUpdate,
  onRemove,
  onAssign,
}: {
  pool: PoolTask[]
  groups: PlanGroup[]
  onAdd: (empIndex: number) => void
  onUpdate: (id: string, text: string) => void
  onRemove: (id: string) => void
  onAssign: (task: PoolTask) => void
}) {
  return (
    <tr className="border-t border-border bg-muted/60">
      <td
        className="sticky left-0 z-10 border-r bg-muted px-2 py-2 align-top text-xs font-semibold text-muted-foreground"
        style={{ width: 64, minWidth: 64, maxWidth: 64 }}
      >
        Pool
      </td>
      <td
        className="num sticky z-10 border-r bg-background px-2 py-2 text-right text-xs text-muted-foreground/40"
        style={{ left: 63, width: 56, minWidth: 56, maxWidth: 56 }}
      >
        —
      </td>
      {groups.map((g, gi) => (
        <Fragment key={`pool-${g.key}`}>
          {g.items.map(({ empIndex }, i) => {
            const tasks = pool.filter((t) => t.empIndex === empIndex)
            return (
              <td
                key={empIndex}
                className={cn(
                  'min-w-[280px] p-0 align-top',
                  i === 0 && gi > 0 ? 'border-l-2 border-foreground/40' : 'border-l border-foreground/30',
                )}
              >
                <PoolCellContent
                  tasks={tasks}
                  onAdd={() => onAdd(empIndex)}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  onAssign={onAssign}
                />
              </td>
            )
          })}
          <td
            className={cn(
              'align-top',
              g.items.length === 0 && gi > 0 ? 'border-l-2 border-foreground/40' : 'border-l border-foreground/30',
            )}
          />
        </Fragment>
      ))}
    </tr>
  )
}

function PoolCellContent({
  tasks,
  onAdd,
  onUpdate,
  onRemove,
  onAssign,
}: {
  tasks: PoolTask[]
  onAdd: () => void
  onUpdate: (id: string, text: string) => void
  onRemove: (id: string) => void
  onAssign: (task: PoolTask) => void
}) {
  return (
    <div className="group/cell flex h-full flex-col gap-0.5 p-1.5">
      {tasks.map((t) => (
        <PoolTaskRow
          key={t.id}
          task={t}
          onUpdate={(text) => onUpdate(t.id, text)}
          onAssign={() => onAssign(t)}
          onRemove={() => onRemove(t.id)}
        />
      ))}
      <button
        onClick={onAdd}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-xs font-medium transition-all',
          tasks.length === 0
            ? 'text-muted-foreground hover:text-foreground'
            : 'rounded border border-dashed text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        title="Aufgabe im Pool anlegen"
      >
        <Plus className="h-3 w-3" />
        Aufgabe
      </button>
    </div>
  )
}

function PoolTaskRow({
  task,
  onUpdate,
  onAssign,
  onRemove,
}: {
  task: PoolTask
  onUpdate: (text: string) => void
  onAssign: () => void
  onRemove: () => void
}) {
  const tone = todoTone(task.text)
  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded px-1.5 py-0.5',
        tone ? TONE_CLASSES[tone] : 'hover:bg-muted',
      )}
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        <textarea
          value={task.text}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Aufgabe…"
          rows={1}
          className="block w-full resize-none bg-transparent text-xs leading-snug outline-none placeholder:text-muted-foreground/50"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
      </div>
      <button
        onClick={onAssign}
        disabled={!task.text.trim()}
        className="mt-0.5 shrink-0 rounded-md border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        title={!task.text.trim() ? 'Text eingeben, dann zuweisen' : 'Zuweisen'}
      >
        Zuweisen…
      </button>
      <button
        onClick={onRemove}
        className="mt-0.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        title="Löschen"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function AssignDialog({
  task,
  employees,
  year,
  onCancel,
  onConfirm,
}: {
  task: PoolTask | null
  employees: Employee[]
  year: number
  onCancel: () => void
  onConfirm: (week: number) => void
}) {
  const today = currentISOWeek()
  const defaultWeek = today.year === year ? today.week : 1
  const [week, setWeek] = useState<number>(defaultWeek)
  const totalWeeks = weeksInISOYear(year)
  const emp = task ? employees[task.empIndex] : undefined

  // Reset selection whenever the dialog opens for a new task.
  useEffect(() => {
    if (!task) return
    setWeek(today.year === year ? today.week : 1)
  }, [task, year, today.week, today.year])

  return (
    <Dialog.Root open={!!task} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background">
          <div className="border-b px-5 py-4">
            <Dialog.Title className="text-sm font-semibold">
              Aufgabe zuweisen
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              „{task?.text || 'Aufgabe'}" für{' '}
              <span className="font-medium text-foreground">
                {emp?.name || `Mitarbeiter ${(task?.empIndex ?? 0) + 1}`}
              </span>{' '}
              in eine KW schieben.
            </Dialog.Description>
          </div>
          <div className="space-y-3 px-5 py-4">
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Kalenderwoche {year}
              </span>
              <select
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-sm tabular-nums outline-none focus:ring-1 focus:ring-ring"
              >
                {Array.from({ length: totalWeeks }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    KW {i + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
            <button
              onClick={onCancel}
              className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              onClick={() => onConfirm(week)}
              disabled={!emp}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Zuweisen
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function MoveAllTodosDialog({
  fromEmpIndex,
  employees,
  roster,
  onCancel,
  onConfirm,
}: {
  fromEmpIndex: number | null
  employees: Employee[]
  roster: Roster | null
  onCancel: () => void
  onConfirm: (toEmpIndex: number) => void
}) {
  const open = fromEmpIndex !== null
  const [toEmpIndex, setToEmpIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!open) setToEmpIndex(null)
  }, [open])

  const displayName = (emp: Employee): string => {
    const link = rosterLinkFor(emp, roster)
    return link?.displayName || emp.name || 'Unbenannt'
  }
  const fromEmp = fromEmpIndex !== null ? employees[fromEmpIndex] : undefined

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background">
          <div className="border-b px-5 py-4">
            <Dialog.Title className="text-sm font-semibold">
              Alle Aufgaben übertragen
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              Alle Wochen-Aufgaben und Pool-Einträge von{' '}
              <span className="font-medium text-foreground">
                {fromEmp ? displayName(fromEmp) : '—'}
              </span>{' '}
              auf einen anderen Mitarbeiter verschieben.
            </Dialog.Description>
          </div>
          <div className="max-h-80 overflow-auto">
            {employees.length <= 1 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                Kein weiterer Mitarbeiter im Plan.
              </div>
            ) : (
              <ul className="divide-y">
                {employees.map((emp, i) => {
                  if (i === fromEmpIndex) return null
                  const active = toEmpIndex === i
                  const link = rosterLinkFor(emp, roster)
                  return (
                    <li key={emp.id}>
                      <button
                        onClick={() => setToEmpIndex(i)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors hover:bg-accent',
                          active && 'bg-accent/60',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{displayName(emp)}</div>
                          {link && (
                            <div className="truncate font-mono text-[10px] text-muted-foreground">
                              {link.contextLabel}
                            </div>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {emp.branch.toUpperCase()}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
            <button
              onClick={onCancel}
              className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              onClick={() => toEmpIndex !== null && onConfirm(toEmpIndex)}
              disabled={toEmpIndex === null}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Übertragen
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function isWeekPast(year: number, week: number): boolean {
  const today = currentISOWeek()
  if (year < today.year) return true
  if (year > today.year) return false
  return week < today.week
}

function PrioStrip({ rows, forecastLabel }: { rows: ProjectRow[]; forecastLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-destructive/5 px-4 py-2 text-xs">
      <span className="inline-flex items-center gap-1 font-semibold text-destructive">
        <Flame className="h-3.5 w-3.5" />
        PRIO ({forecastLabel})
      </span>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {rows.map((r) => (
          <span
            key={r.id}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium',
              r.prioAllowOvertime
                ? 'bg-amber-100 text-amber-900'
                : 'bg-background text-foreground border',
            )}
            title={r.prioAllowOvertime ? 'Projektleiter lässt Überstunden zu' : undefined}
          >
            <span className="font-mono text-[10px] opacity-60">{r.projNr}</span>
            <span>{r.projektname}</span>
            {r.prioAllowOvertime && <span className="font-mono text-[9px] font-bold">ÜS</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

function WeekTodosCell({
  todos,
  empIndex,
  week,
  locked,
  onAdd,
  onUpdate,
  onRemove,
}: {
  todos: WeekTodo[]
  empIndex: number
  week: number
  locked: boolean
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<Omit<WeekTodo, 'id'>>) => void
  onRemove: (id: string) => void
}) {
  const empty = todos.length === 0
  const [collapsed, setCollapsed] = useState(false)
  const collapsible = todos.length >= 2
  const isCollapsed = collapsible && collapsed
  // Droppable area over the whole cell so todos can be dropped on empty
  // cells (or into a gap below the last todo).
  const { setNodeRef } = useDroppable({
    id: `cell:${empIndex}:${week}`,
    data: { empIndex, week },
    disabled: locked,
  })
  return (
    <div ref={setNodeRef} className="group/cell flex h-full flex-col gap-0.5 p-1.5">
      {collapsible && (
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 self-start rounded px-1 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          title={isCollapsed ? 'Aufgaben einblenden' : 'Aufgaben ausblenden'}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <Num>{todos.length}</Num> Aufgaben
        </button>
      )}
      {!isCollapsed && (
        <SortableContext
          items={todos.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {todos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              empIndex={empIndex}
              week={week}
              locked={locked}
              onUpdate={(patch) => onUpdate(todo.id, patch)}
              onRemove={() => onRemove(todo.id)}
            />
          ))}
        </SortableContext>
      )}
      {!locked && !isCollapsed && (
        <button
          onClick={onAdd}
          className={cn(
            'flex items-center gap-1 px-2 py-1 text-xs font-medium transition-all',
            empty && 'text-red-700 hover:text-red-900 dark:text-red-200 dark:hover:text-red-100',
            !empty &&
              'rounded border border-dashed text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
          title="Aufgabe hinzufügen"
        >
          <Plus className="h-3 w-3" />
          Aufgabe
        </button>
      )}
    </div>
  )
}

function TodoRow({
  todo,
  empIndex,
  week,
  locked,
  onUpdate,
  onRemove,
}: {
  todo: WeekTodo
  empIndex: number
  week: number
  locked: boolean
  onUpdate: (patch: Partial<Omit<WeekTodo, 'id'>>) => void
  onRemove: () => void
}) {
  const tone = todoTone(todo.text)
  const dayPickerTone = tone === 'blue' ? 'blue' : tone === 'orange' ? 'orange' : null
  // Carried-over originals are locked and dimmed; duplicates stay editable
  // but carry a chip pointing to their origin so the PM can trace them.
  const isCarriedOrigin = !!todo.carriedOver
  const effectiveLocked = locked || isCarriedOrigin
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id, data: { empIndex, week }, disabled: effectiveLocked })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  // --- Project attach via `#` autocomplete (Projektliste) -------------------
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const projektlisteDoc = useProjektliste((s) => s.doc)
  const projektlisteStatus = useProjektliste((s) => s.status)
  const loadProjektliste = useProjektliste((s) => s.load)
  const projektRows = projektlisteDoc?.rows ?? []
  const attachedProject = useMemo(
    () => (todo.projectId ? projektRows.find((r) => r.id === todo.projectId) : undefined),
    [todo.projectId, projektRows],
  )

  type HashState = { query: string; hashPos: number }
  const [hashState, setHashState] = useState<HashState | null>(null)
  const [pickerIdx, setPickerIdx] = useState(0)

  // Lazy-load Projektliste the first time a picker is triggered.
  useEffect(() => {
    if (hashState && projektlisteStatus === 'idle') void loadProjektliste()
  }, [hashState, projektlisteStatus, loadProjektliste])

  const filtered = useMemo(() => {
    if (!hashState) return []
    const q = hashState.query.toLowerCase()
    const rows = q
      ? projektRows.filter(
          (r) =>
            r.projekt.toLowerCase().includes(q) ||
            r.fachbereich.toLowerCase().includes(q) ||
            r.projektleiter.toLowerCase().includes(q),
        )
      : projektRows
    return rows.slice(0, 8)
  }, [hashState, projektRows])

  // Clamp selected index if the filter list shrinks under the cursor.
  useEffect(() => {
    if (pickerIdx > 0 && pickerIdx >= filtered.length) setPickerIdx(0)
  }, [pickerIdx, filtered.length])

  function detectHash(text: string, caret: number): HashState | null {
    const upToCursor = text.slice(0, caret)
    // Hash must start at buffer start or after whitespace; query excludes
    // whitespace and further `#` so typing a space ends the picker.
    const m = upToCursor.match(/(?:^|\s)#([^\s#]*)$/)
    if (!m) return null
    return { query: m[1]!, hashPos: caret - m[1]!.length - 1 }
  }

  const handleText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    onUpdate({ text })
    const next = detectHash(text, e.target.selectionStart)
    setHashState(next)
    setPickerIdx(0)
  }

  const pickProject = (rowId: string) => {
    if (!hashState) return
    const el = taRef.current
    const caret = el?.selectionStart ?? todo.text.length
    const before = todo.text.slice(0, hashState.hashPos)
    const after = todo.text.slice(caret)
    // Clean the glue: collapse double spaces left behind by the strip.
    const cleaned = (before + after).replace(/ {2,}/g, ' ').replace(/ +$/, '').trim()
    onUpdate({ text: cleaned, projectId: rowId })
    setHashState(null)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!hashState) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setHashState(null)
      return
    }
    if (filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setPickerIdx((i) => (i + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setPickerIdx((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const p = filtered[pickerIdx] ?? filtered[0]
      if (p) pickProject(p.id)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const p = filtered[pickerIdx] ?? filtered[0]
      if (p) pickProject(p.id)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col gap-0.5 rounded px-1.5 py-0.5',
        tone ? TONE_CLASSES[tone] : 'hover:bg-muted',
        isDragging && 'z-20 ring-1 ring-ring',
        isCarriedOrigin && 'opacity-55 grayscale',
      )}
    >
      <div className="flex items-start gap-2">
        {!effectiveLocked && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/40 opacity-0 transition-opacity hover:text-muted-foreground group-hover:opacity-100 active:cursor-grabbing"
            title="Verschieben"
            aria-label="Aufgabe verschieben"
            type="button"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          {attachedProject && (
            <button
              type="button"
              onClick={() => onUpdate({ projectId: undefined })}
              disabled={isCarriedOrigin}
              className="mb-0.5 inline-flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              title={`Projekt entfernen: ${attachedProject.projekt}`}
            >
              <span className="truncate">{attachedProject.projekt}</span>
              <X className="h-2.5 w-2.5 shrink-0" />
            </button>
          )}
          <textarea
            ref={taRef}
            value={todo.text}
            onChange={handleText}
            onKeyDown={onKeyDown}
            onBlur={() => setHashState(null)}
            placeholder={attachedProject ? 'Aufgabe…' : 'Aufgabe… (# für Projekt)'}
            rows={1}
            readOnly={isCarriedOrigin}
            className={cn(
              'block w-full resize-none bg-transparent text-xs leading-snug outline-none placeholder:text-muted-foreground/50',
              todo.state === 'erledigt' && 'line-through opacity-60',
              isCarriedOrigin && 'cursor-not-allowed',
            )}
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          {hashState && (
            <div
              role="listbox"
              aria-label="Projekt wählen"
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border bg-card text-xs"
            >
              {filtered.length === 0 ? (
                <div className="px-2 py-1.5 text-muted-foreground">
                  {projektlisteStatus === 'loading'
                    ? 'Projekte werden geladen …'
                    : 'Kein Projekt gefunden.'}
                </div>
              ) : (
                filtered.map((row, i) => (
                  <button
                    key={row.id}
                    role="option"
                    aria-selected={i === pickerIdx}
                    type="button"
                    // onMouseDown so blur doesn't close the picker before the
                    // click handler runs.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pickProject(row.id)
                    }}
                    onMouseEnter={() => setPickerIdx(i)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2 py-1 text-left',
                      i === pickerIdx ? 'bg-accent text-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{row.projekt}</span>
                    {row.fachbereich && (
                      <span className="shrink-0 text-muted-foreground">{row.fachbereich}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {!isCarriedOrigin && (
          <button
            onClick={onRemove}
            className="mt-0.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            title="Löschen"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {isCarriedOrigin && (
        <div className="ml-6 inline-flex w-fit items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          verschleppt
        </div>
      )}
      {todo.carriedFrom && (
        <div className="ml-6 inline-flex w-fit items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
          aus KW {todo.carriedFrom.week}
          {todo.carriedCount && todo.carriedCount > 1 && (
            <span className="font-mono tabular-nums">· {todo.carriedCount}/3</span>
          )}
        </div>
      )}
      {dayPickerTone && (
        <DayPicker
          tone={dayPickerTone}
          days={todo.days ?? []}
          onChange={(days) => onUpdate({ days })}
        />
      )}
    </div>
  )
}

function DayPicker({
  tone,
  days,
  onChange,
}: {
  tone: 'blue' | 'orange'
  days: number[]
  onChange: (days: number[]) => void
}) {
  const theme = DAY_PICKER_THEMES[tone]
  const toggle = (d: number) => {
    const set = new Set(days)
    if (set.has(d)) set.delete(d)
    else set.add(d)
    const next = Array.from(set).sort((a, b) => a - b)
    onChange(next)
  }
  const all = days.length === 0
  return (
    <div className="ml-6 flex flex-wrap items-center gap-1 pt-0.5">
      <button
        type="button"
        onClick={() => onChange([])}
        className={cn(
          'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
          all ? theme.on : cn('text-muted-foreground', theme.hover),
        )}
        title="Ganze Woche"
      >
        ganze Woche
      </button>
      {DAYS_LABELS.map((lbl, i) => {
        const d = i + 1
        const on = days.includes(d)
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            className={cn(
              'inline-flex h-5 w-6 items-center justify-center rounded text-[10px] font-medium transition-colors',
              on ? theme.on : cn('text-muted-foreground', theme.hover),
            )}
            title={`${lbl}`}
          >
            {lbl}
          </button>
        )
      })}
    </div>
  )
}

// Count of carried-over duplicates landing in this week. Rendered next to the
// KW number so the PM sees at a glance which weeks have rollover traffic.
function WeekCarryBadge({
  plan,
  week,
}: {
  plan: { todos?: Record<string, WeekTodo[]> }
  week: number
}) {
  let n = 0
  for (const [k, list] of Object.entries(plan.todos ?? {})) {
    const [, wStr] = k.split(':')
    if (Number(wStr) !== week) continue
    for (const t of list) if (t.carriedFrom) n++
  }
  if (n === 0) return null
  return (
    <div
      className="mt-0.5 inline-flex items-center rounded bg-amber-100 px-1 font-mono text-[9px] font-semibold tabular-nums text-amber-900 dark:bg-amber-500/15 dark:text-amber-300"
      title={`${n} verschleppte Aufgabe${n === 1 ? '' : 'n'} dieser Woche`}
    >
      ↻ {n}
    </div>
  )
}

const LEGEND_ITEMS: { label: string; tone: Exclude<TodoTone, null>; purpose?: string }[] = [
  { label: 'Aufgabe', tone: 'red' },
  { label: 'Abgabe', tone: 'green' },
  { label: 'Abstimmen', tone: 'yellow' },
  { label: 'Urlaub', tone: 'blue' },
  { label: 'Mobiles Arbeiten', tone: 'orange' },
  {
    label: 'Pufferarbeiten',
    tone: 'purple',
    purpose:
      'Pufferarbeiten, wenn der MA noch Kapa hat, werden hier notiert. Wird er früher mit seinen ToDos fertig, kann er diese Aufgaben reinnehmen.',
  },
]

function PlanLegend() {
  return (
    <InfoTooltip>
      <div className="space-y-2">
        <div className="font-medium">Schlüsselwörter</div>
        <div className="space-y-1.5">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.tone} className="space-y-1">
              <span className={`inline-block px-1.5 py-0.5 font-mono text-[11px] ${LEGEND_CLASSES[item.tone]}`}>
                {item.label}
              </span>
              {item.purpose && (
                <div className="pl-2 text-[11px] leading-snug text-muted-foreground">
                  <span className="font-medium text-foreground/80">Zweck: </span>
                  {item.purpose}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t pt-2 text-muted-foreground">
          Zeile färbt sich automatisch anhand des Schlüsselworts. Abgelaufene Wochen sind gesperrt.
          Status und Fortschritt werden in der Übersicht gepflegt.
        </div>
      </div>
    </InfoTooltip>
  )
}

// Look up the roster entry a plan employee is linked to and build a short
// "Team · Standort" context label used in the column header.
function rosterLinkFor(
  emp: Employee,
  roster: Roster | null,
): { displayName: string; contextLabel: string } | null {
  if (!emp.rosterEmployeeId || !roster) return null
  const rosterEmp = roster.employees.find((r) => r.id === emp.rosterEmployeeId)
  if (!rosterEmp) return null
  const team = rosterEmp.teamId ? roster.teams.find((t) => t.id === rosterEmp.teamId) : undefined
  const location = team?.locationId
    ? roster.locations.find((l) => l.id === team.locationId)
    : undefined
  const displayName =
    [rosterEmp.vorname, rosterEmp.name].filter((s) => s.trim().length > 0).join(' ') ||
    'Unbenannt'
  const parts = [team?.name, location?.name].filter(Boolean)
  return {
    displayName,
    contextLabel: parts.length > 0 ? parts.join(' · ') : 'ohne Team',
  }
}

// Derive DE/PL grouping from a roster employee via team → location. Falls back
// to 'de' when the employee has no team or the team's location doesn't resolve.
function branchForRosterEmployee(r: RosterEmployee, roster: Roster | null): Branch {
  if (!roster || !r.teamId) return 'de'
  const team = roster.teams.find((t) => t.id === r.teamId)
  if (!team?.locationId) return 'de'
  const loc = roster.locations.find((l) => l.id === team.locationId)
  return loc?.name === 'Polen' ? 'pl' : 'de'
}

// Group plan employees by their roster-location name. Legacy (unlinked)
// employees fall into a per-branch bucket labeled "DE" / "PL". Group order
// follows the roster.locations[] order so the layout stays stable when the
// admin renames a location.
export type PlanGroup = {
  key: string
  label: string
  branch: Branch
  items: { emp: Employee; empIndex: number }[]
}
function buildPlanGroups(
  entries: { emp: Employee; empIndex: number }[],
  roster: Roster | null,
): PlanGroup[] {
  const groups = new Map<string, PlanGroup>()
  const ensure = (key: string, label: string, branch: Branch): PlanGroup => {
    let g = groups.get(key)
    if (!g) {
      g = { key, label, branch, items: [] }
      groups.set(key, g)
    }
    return g
  }
  if (roster) {
    for (const loc of roster.locations) {
      ensure(`loc:${loc.id}`, loc.name || 'Standort', loc.name === 'Polen' ? 'pl' : 'de')
    }
  }
  for (const entry of entries) {
    const linkId = entry.emp.rosterEmployeeId
    const rosterEmp = linkId ? roster?.employees.find((r) => r.id === linkId) : undefined
    if (rosterEmp) {
      const team = rosterEmp.teamId ? roster?.teams.find((t) => t.id === rosterEmp.teamId) : undefined
      const loc = team?.locationId ? roster?.locations.find((l) => l.id === team.locationId) : undefined
      if (loc) {
        ensure(`loc:${loc.id}`, loc.name || 'Standort', loc.name === 'Polen' ? 'pl' : 'de').items.push(entry)
      } else {
        ensure('no-loc', 'Ohne Standort', entry.emp.branch).items.push(entry)
      }
    } else {
      const branch = entry.emp.branch
      ensure(`branch:${branch}`, branch.toUpperCase(), branch).items.push(entry)
    }
  }
  return Array.from(groups.values()).filter((g) => g.items.length > 0)
}

function RosterPickerDialog({
  open,
  onClose,
  roster,
  linkedIds,
  onPick,
  onPickAll,
}: {
  open: boolean
  onClose: () => void
  roster: Roster | null
  linkedIds: Set<string>
  onPick: (rosterEmp: RosterEmployee) => void
  onPickAll: (list: RosterEmployee[]) => void
}) {
  const available = useMemo(
    () => (roster?.employees ?? []).filter((e) => !linkedIds.has(e.id)),
    [roster, linkedIds],
  )
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background">
          <div className="border-b px-5 py-4">
            <Dialog.Title className="text-sm font-semibold">
              Mitarbeiter aus Roster hinzufügen
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              Wähle einen Mitarbeiter aus dem Mitarbeiter-Modul. Team und Standort kommen
              aus dem Roster und erscheinen im Spaltenkopf.
            </Dialog.Description>
          </div>
          <div className="max-h-80 overflow-auto">
            {available.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                Alle Roster-Mitarbeiter sind bereits im Plan eingebunden. Lege neue unter
                Mitarbeiter an.
              </div>
            ) : (
              <ul className="divide-y">
                {available.map((r) => {
                  const team = r.teamId ? roster?.teams.find((t) => t.id === r.teamId) : undefined
                  const location = team?.locationId
                    ? roster?.locations.find((l) => l.id === team.locationId)
                    : undefined
                  const context = [team?.name, location?.name].filter(Boolean).join(' · ') || 'ohne Team'
                  const display =
                    [r.vorname, r.name].filter((s) => s.trim().length > 0).join(' ') || 'Unbenannt'
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          onPick(r)
                          onClose()
                        }}
                        className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{display}</div>
                          <div className="truncate font-mono text-[10px] text-muted-foreground">
                            {context}
                          </div>
                        </div>
                        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
            <button
              onClick={() => {
                onPickAll(available)
                onClose()
              }}
              disabled={available.length === 0}
              className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Alle hinzufügen (<Num>{available.length}</Num>)
            </button>
            <button
              onClick={onClose}
              className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Fertig
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Dropdown that lists all roster teams (grouped by location via optgroup) plus
// an "Alle" default. Legacy-only plans show just the "Alle" option.
export function TeamFilterToggle({
  value,
  onChange,
}: {
  value: TeamFilter
  onChange: (v: TeamFilter) => void
}) {
  const roster = useRoster((s) => s.roster)

  const groups = useMemo(() => {
    const locs = roster?.locations ?? []
    const teams = roster?.teams ?? []
    type Group = { key: string; label: string; teams: { id: string; name: string }[] }
    const byLocation = new Map<string, Group>()
    const noLocation: Group = { key: 'no-loc', label: 'Ohne Standort', teams: [] }
    for (const t of teams) {
      const teamEntry = { id: t.id, name: t.name || 'Unbenannt' }
      if (t.locationId && locs.some((l) => l.id === t.locationId)) {
        let g = byLocation.get(t.locationId)
        if (!g) {
          const loc = locs.find((l) => l.id === t.locationId)
          g = { key: t.locationId, label: loc?.name || 'Standort', teams: [] }
          byLocation.set(t.locationId, g)
        }
        g.teams.push(teamEntry)
      } else {
        noLocation.teams.push(teamEntry)
      }
    }
    // Preserve roster.locations declaration order.
    const ordered: Group[] = []
    for (const l of locs) {
      const g = byLocation.get(l.id)
      if (g) ordered.push(g)
    }
    if (noLocation.teams.length > 0) ordered.push(noLocation)
    return ordered
  }, [roster])

  const empty = groups.length === 0

  return (
    <label className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs font-medium">
      <span className="text-muted-foreground">Team</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TeamFilter)}
        className="rounded bg-transparent text-xs font-medium outline-none"
        title={empty ? 'Teams werden im Mitarbeiter-Modul gepflegt' : 'Nach Team filtern'}
      >
        <option value="all">Alle</option>
        {groups.map((g) => (
          <optgroup key={g.key} label={g.label}>
            {g.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
