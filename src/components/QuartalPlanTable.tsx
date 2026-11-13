import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { usePlan, cellKey, type TeamFilter } from '@/plan-store'
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
import { ChevronDown, ChevronRight, Flame, Maximize2, Minimize2, Plus, X } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Num } from '@/components/ui/num'

export type TodoTone = 'red' | 'green' | 'yellow' | 'blue' | 'purple' | null

export function todoTone(text: string): TodoTone {
  const t = text.toLowerCase()
  if (t.includes('aufgabe')) return 'red'
  if (t.includes('abgabe')) return 'green'
  if (t.includes('abstimmen')) return 'yellow'
  if (t.includes('urlaub')) return 'blue'
  if (t.includes('pufferarbeiten')) return 'purple'
  return null
}

export const TONE_CLASSES: Record<Exclude<TodoTone, null>, string> = {
  red: 'text-red-700 dark:text-red-200 border-l-2 border-red-500 pl-1.5 bg-red-500/15',
  green: 'text-emerald-600 border-l-2 border-emerald-500 pl-1.5',
  yellow: 'text-amber-600 border-l-2 border-amber-500 pl-1.5',
  blue: 'text-sky-600 border-l-2 border-sky-500 pl-1.5',
  purple: 'text-violet-600 border-l-2 border-violet-500 pl-1.5',
}

export const URLAUB_DAYS_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'] as const

const LEGEND_CLASSES: Record<Exclude<TodoTone, null>, string> = {
  red: 'text-red-600 border-l-2 border-red-500',
  green: 'text-emerald-600 border-l-2 border-emerald-500',
  yellow: 'text-amber-600 border-l-2 border-amber-500',
  blue: 'text-sky-600 border-l-2 border-sky-500',
  purple: 'text-violet-600 border-l-2 border-violet-500',
}

const DAYS_LABELS = URLAUB_DAYS_LABELS

export function QuartalPlanTable() {
  const year = usePlan((s) => s.year)
  const quarter = usePlan((s) => s.quarter)
  const teamFilter = usePlan((s) => s.teamFilter)
  const setTeamFilter = usePlan((s) => s.setTeamFilter)
  const plan = usePlan((s) => s.plan)
  const renameEmployee = usePlan((s) => s.renameEmployee)
  const setEmployeeBranch = usePlan((s) => s.setEmployeeBranch)
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

  const roster = useRoster((s) => s.roster)
  const loadRoster = useRoster((s) => s.load)
  useEffect(() => {
    if (!roster) void loadRoster()
  }, [roster, loadRoster])

  const [assignFor, setAssignFor] = useState<PoolTask | null>(null)
  const [rosterPickerOpen, setRosterPickerOpen] = useState(false)

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

  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void containerRef.current?.requestFullscreen()
  }

  if (!plan) return null

  // Keep original indices so cell/todo keys stay stable, but group by branch for layout.
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
  const deEmployees = filtered.filter((e) => e.emp.branch === 'de')
  const plEmployees = filtered.filter((e) => e.emp.branch === 'pl')
  const groups: { branch: Branch; label: string; items: typeof indexed }[] = [
    { branch: 'de' as Branch, label: 'Team Deutschland', items: deEmployees },
    { branch: 'pl' as Branch, label: 'Team Polen', items: plEmployees },
  ].filter((g) => g.items.length > 0)

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
      <Num>{plan.employees.length}</Num> Mitarbeiter (<Num>{deEmployees.length}</Num> DE · <Num>{plEmployees.length}</Num> PL) ·{' '}
      <Num>{weekRows.length}</Num> Wochen · <Num>{todoCount}</Num> Aufgaben
    </>
  )

  return (
    <div
      ref={containerRef}
      className={cn(isFullscreen && 'flex h-screen w-screen flex-col bg-background p-4')}
    >
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
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Vollbild beenden' : 'Vollbild anzeigen'}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={isFullscreen ? 'Vollbild beenden' : 'Vollbild anzeigen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
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
          className={cn(
            'overflow-auto',
            // Cap to a viewport-height box when NOT in fullscreen so the
            // horizontal scrollbar sits near the viewport bottom instead of
            // forcing users to page-scroll to find it.
            isFullscreen ? 'min-h-0 flex-1' : 'max-h-[calc(100vh-240px)]',
          )}
        >
          <table className="w-full border-collapse text-sm">
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
                    key={g.branch}
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
                  <Fragment key={`th-${g.branch}`}>
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
                            <select
                              value={emp.branch}
                              onChange={(e) => setEmployeeBranch(empIndex, e.target.value as Branch)}
                              title="Team wechseln"
                              className="rounded border bg-background px-1 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground outline-none"
                            >
                              <option value="de">DE</option>
                              <option value="pl">PL</option>
                            </select>
                            <button
                              onClick={() => removeEmployee(empIndex)}
                              className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                              title="Mitarbeiter aus Plan entfernen"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </th>
                      )
                    })}
                    <th
                      key={`add-${g.branch}`}
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
                    </td>
                    {groups.map((g, gi) => (
                      <Fragment key={`row-${row.week}-${g.branch}`}>
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
                                cellEmpty && 'bg-red-500/25',
                              )}
                            >
                              <WeekTodosCell
                                todos={todos}
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
      </Section>

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
          // Default branch to 'de' — PM can switch via existing DE/PL dropdown
          // in the column header.
          addRosterEmployee(r.id, display, 'de')
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
  groups: { branch: Branch; label: string; items: { emp: Employee; empIndex: number }[] }[]
  onAdd: (empIndex: number) => void
  onUpdate: (id: string, text: string) => void
  onRemove: (id: string) => void
  onAssign: (task: PoolTask) => void
}) {
  return (
    <tr className="border-t-4 border-foreground/30">
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
        <Fragment key={`pool-${g.branch}`}>
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background shadow-xl">
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
  locked,
  onAdd,
  onUpdate,
  onRemove,
}: {
  todos: WeekTodo[]
  locked: boolean
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<Omit<WeekTodo, 'id'>>) => void
  onRemove: (id: string) => void
}) {
  const empty = todos.length === 0
  const [collapsed, setCollapsed] = useState(false)
  const collapsible = todos.length >= 2
  const isCollapsed = collapsible && collapsed
  return (
    <div className="group/cell flex h-full flex-col gap-0.5 p-1.5">
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
      {!isCollapsed &&
        todos.map((todo) => (
          <TodoRow
            key={todo.id}
            todo={todo}
            onUpdate={(patch) => onUpdate(todo.id, patch)}
            onRemove={() => onRemove(todo.id)}
          />
        ))}
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
  onUpdate,
  onRemove,
}: {
  todo: WeekTodo
  onUpdate: (patch: Partial<Omit<WeekTodo, 'id'>>) => void
  onRemove: () => void
}) {
  const tone = todoTone(todo.text)
  const isUrlaub = tone === 'blue'
  return (
    <div
      className={cn(
        'group flex flex-col gap-0.5 rounded px-1.5 py-0.5',
        tone ? TONE_CLASSES[tone] : 'hover:bg-muted',
      )}
    >
      <div className="flex items-start gap-2">
        {/* overflow-hidden on the wrapper caps the textarea's intrinsic width
            so fieldSizing: content grows only vertically, not horizontally. */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <textarea
            value={todo.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Aufgabe…"
            rows={1}
            className={cn(
              'block w-full resize-none bg-transparent text-xs leading-snug outline-none placeholder:text-muted-foreground/50',
              todo.state === 'erledigt' && 'line-through opacity-60',
            )}
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
        </div>
        <button
          onClick={onRemove}
          className="mt-0.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          title="Löschen"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {isUrlaub && <UrlaubDayPicker days={todo.days ?? []} onChange={(days) => onUpdate({ days })} />}
    </div>
  )
}

function UrlaubDayPicker({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
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
          all ? 'bg-sky-100 text-sky-900' : 'text-muted-foreground hover:bg-sky-50 hover:text-sky-900',
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
              on
                ? 'bg-sky-100 text-sky-900'
                : 'text-muted-foreground hover:bg-sky-50 hover:text-sky-900',
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

const LEGEND_ITEMS: { label: string; tone: Exclude<TodoTone, null>; purpose?: string }[] = [
  { label: 'Aufgabe', tone: 'red' },
  { label: 'Abgabe', tone: 'green' },
  { label: 'Abstimmen', tone: 'yellow' },
  { label: 'Urlaub', tone: 'blue' },
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

function RosterPickerDialog({
  open,
  onClose,
  roster,
  linkedIds,
  onPick,
}: {
  open: boolean
  onClose: () => void
  roster: Roster | null
  linkedIds: Set<string>
  onPick: (rosterEmp: RosterEmployee) => void
}) {
  const available = useMemo(
    () => (roster?.employees ?? []).filter((e) => !linkedIds.has(e.id)),
    [roster, linkedIds],
  )
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background shadow-xl">
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
          <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
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
