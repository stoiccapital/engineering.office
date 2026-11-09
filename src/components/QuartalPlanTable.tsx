import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { usePlan, cellKey } from '@/plan-store'
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

type TodoTone = 'red' | 'green' | 'yellow' | 'blue' | 'purple' | null

function todoTone(text: string): TodoTone {
  const t = text.toLowerCase()
  if (t.includes('aufgabe')) return 'red'
  if (t.includes('abgabe')) return 'green'
  if (t.includes('abstimmen')) return 'yellow'
  if (t.includes('urlaub')) return 'blue'
  if (t.includes('pufferarbeiten')) return 'purple'
  return null
}

const TONE_CLASSES: Record<Exclude<TodoTone, null>, string> = {
  red: 'text-red-700 dark:text-red-200 border-l-2 border-red-500 pl-1.5 bg-red-500/15',
  green: 'text-emerald-600 border-l-2 border-emerald-500 pl-1.5',
  yellow: 'text-amber-600 border-l-2 border-amber-500 pl-1.5',
  blue: 'text-sky-600 border-l-2 border-sky-500 pl-1.5',
  purple: 'text-violet-600 border-l-2 border-violet-500 pl-1.5',
}

const LEGEND_CLASSES: Record<Exclude<TodoTone, null>, string> = {
  red: 'text-red-600 border-l-2 border-red-500',
  green: 'text-emerald-600 border-l-2 border-emerald-500',
  yellow: 'text-amber-600 border-l-2 border-amber-500',
  blue: 'text-sky-600 border-l-2 border-sky-500',
  purple: 'text-violet-600 border-l-2 border-violet-500',
}

const DAYS_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'] as const

export function QuartalPlanTable() {
  const year = usePlan((s) => s.year)
  const quarter = usePlan((s) => s.quarter)
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

  const [assignFor, setAssignFor] = useState<PoolTask | null>(null)

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
  const deEmployees = indexed.filter((e) => e.emp.branch === 'de')
  const plEmployees = indexed.filter((e) => e.emp.branch === 'pl')
  const groups: { branch: Branch; label: string; items: typeof indexed }[] = [
    { branch: 'de', label: 'Team Deutschland', items: deEmployees },
    { branch: 'pl', label: 'Team Polen', items: plEmployees },
  ]

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
        <div className={cn('overflow-auto', isFullscreen && 'min-h-0 flex-1')}>
          <table className="w-full border-collapse text-sm">
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
                      gi > 0 && 'border-l-2 border-foreground/20',
                    )}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b">
                <th className="sticky left-0 z-30 w-16 bg-muted px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                  Monat
                </th>
                <th className="sticky left-16 z-30 w-14 border-r bg-muted px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                  KW
                </th>
                {groups.map((g, gi) => (
                  <Fragment key={`th-${g.branch}`}>
                    {g.items.map(({ emp, empIndex }, i) => (
                      <th
                        key={emp.id}
                        className={cn(
                          'min-w-[280px] px-2 py-2 text-left text-xs font-medium text-muted-foreground',
                          i === 0 && gi > 0 ? 'border-l-2 border-foreground/20' : 'border-l',
                        )}
                      >
                        <div className="group flex items-center gap-1">
                          <input
                            value={emp.name}
                            onChange={(e) => renameEmployee(empIndex, e.target.value)}
                            className="w-full rounded bg-foreground/[0.03] px-1 py-0.5 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
                          />
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
                            title="Mitarbeiter entfernen"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th
                      key={`add-${g.branch}`}
                      className={cn(
                        'w-10 px-1 py-2',
                        g.items.length === 0 && gi > 0 ? 'border-l-2 border-foreground/20' : 'border-l',
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
                    {row.firstOfMonth && (
                      <td
                        rowSpan={row.monthSpan}
                        className="sticky left-0 z-10 border-r bg-muted px-2 py-1 align-top text-xs font-semibold text-muted-foreground"
                      >
                        {MONTH_LABELS_DE[row.month]}
                      </td>
                    )}
                    <td
                      className={cn(
                        'num sticky left-16 z-10 border-r bg-background px-2 py-1 text-xs tabular-nums',
                        isToday ? 'font-semibold text-foreground' : 'text-muted-foreground',
                        isPast && 'bg-muted/40 text-muted-foreground/60',
                      )}
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
                                i === 0 && gi > 0 ? 'border-l-2 border-foreground/20' : 'border-l',
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
                            g.items.length === 0 && gi > 0 ? 'border-l-2 border-foreground/20' : 'border-l',
                          )}
                        />
                      </Fragment>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div
        className={cn(
          // In fullscreen, cap the pool so the grid keeps most of the viewport
          // and let the pool's own list scroll internally when long.
          isFullscreen && 'mt-2 max-h-[30vh] shrink-0 overflow-auto',
        )}
      >
        <AufgabenPool
          pool={plan.pool ?? []}
          onAdd={() => addPoolTask('')}
          onUpdate={updatePoolTask}
          onRemove={removePoolTask}
          onAssign={(task) => setAssignFor(task)}
        />
      </div>

      <AssignDialog
        task={assignFor}
        employees={plan.employees}
        year={year}
        onCancel={() => setAssignFor(null)}
        onConfirm={(empIndex, week) => {
          if (assignFor) assignPoolTask(assignFor.id, empIndex, week)
          setAssignFor(null)
        }}
      />
    </div>
  )
}

function AufgabenPool({
  pool,
  onAdd,
  onUpdate,
  onRemove,
  onAssign,
}: {
  pool: PoolTask[]
  onAdd: () => void
  onUpdate: (id: string, text: string) => void
  onRemove: (id: string) => void
  onAssign: (task: PoolTask) => void
}) {
  return (
    <Section
      title="Aufgaben-Pool"
      subtitle={
        <>
          <Num>{pool.length}</Num>{' '}
          {pool.length === 1 ? 'ungeplante Aufgabe' : 'ungeplante Aufgaben'} · schiebst du bei
          Bedarf in eine Woche
        </>
      }
      action={
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Aufgabe
        </button>
      }
      padded={false}
    >
      {pool.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          Noch keine Aufgaben im Pool.
        </div>
      ) : (
        <ul className="divide-y">
          {pool.map((t) => (
            <li key={t.id} className="group flex items-center gap-2 px-3 py-2">
              <textarea
                value={t.text}
                onChange={(e) => onUpdate(t.id, e.target.value)}
                placeholder="Aufgabe…"
                rows={1}
                className="min-w-0 flex-1 resize-none bg-transparent text-sm leading-snug outline-none placeholder:text-muted-foreground/50"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <button
                onClick={() => onAssign(t)}
                disabled={!t.text.trim()}
                className="shrink-0 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                title={!t.text.trim() ? 'Text eingeben, dann zuweisen' : 'Zuweisen'}
              >
                Zuweisen…
              </button>
              <button
                onClick={() => onRemove(t.id)}
                className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                title="Löschen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
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
  onConfirm: (empIndex: number, week: number) => void
}) {
  const today = currentISOWeek()
  const defaultWeek = today.year === year ? today.week : 1
  const [empIndex, setEmpIndex] = useState<number>(0)
  const [week, setWeek] = useState<number>(defaultWeek)
  const totalWeeks = weeksInISOYear(year)

  // Reset selection whenever the dialog opens for a new task.
  useEffect(() => {
    if (!task) return
    setEmpIndex(0)
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
              „{task?.text || 'Aufgabe'}" einem Mitarbeiter in einer KW zuordnen.
            </Dialog.Description>
          </div>
          <div className="space-y-3 px-5 py-4">
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Mitarbeiter
              </span>
              <select
                value={empIndex}
                onChange={(e) => setEmpIndex(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                {employees.map((e, i) => (
                  <option key={e.id} value={i}>
                    {e.name || `Mitarbeiter ${i + 1}`} ({e.branch.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
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
              onClick={() => onConfirm(empIndex, week)}
              disabled={employees.length === 0}
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
