import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { usePlan, cellKey } from '@/plan-store'
import { useForecast } from '@/store'
import {
  MAX_TODOS_PER_WEEK,
  type Branch,
  type Employee,
  type ProjectRow,
  type TodoState,
  type WeekTodo,
  nextTodoState,
} from '@/types'
import {
  MONTH_LABELS_DE,
  currentISOWeek,
  monthOfISOWeek,
  quarterOfISOWeek,
  weeksInISOYear,
} from '@/lib/iso-week'
import { cn } from '@/lib/utils'
import { Circle, CircleDot, CircleCheck, Flame, Maximize2, Minimize2, Plus, X } from 'lucide-react'
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
  red: 'text-red-600 border-l-2 border-red-500 pl-1.5',
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
        <div className={cn('overflow-auto', isFullscreen && 'max-h-[calc(100vh-220px)]')}>
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
                            className="w-full rounded bg-transparent px-1 py-0.5 text-sm font-semibold text-foreground outline-none focus:bg-background focus:ring-1 focus:ring-ring"
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
                          return (
                            <td
                              key={emp.id}
                              className={cn(
                                'min-w-[280px] p-0 align-top',
                                i === 0 && gi > 0 ? 'border-l-2 border-foreground/20' : 'border-l',
                                isPast && 'pointer-events-none opacity-60',
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
    </div>
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
  const atLimit = todos.length >= MAX_TODOS_PER_WEEK
  const empty = todos.length === 0
  return (
    <div
      className={cn(
        'group/cell flex flex-col gap-0.5 p-1.5',
        empty && !locked && 'border-l-2 border-red-400/50',
      )}
    >
      {todos.map((todo) => (
        <TodoRow
          key={todo.id}
          todo={todo}
          onUpdate={(patch) => onUpdate(todo.id, patch)}
          onRemove={() => onRemove(todo.id)}
        />
      ))}
      {!locked && (
        <button
          onClick={onAdd}
          disabled={atLimit}
          className={cn(
            'flex items-center gap-1 px-2 py-1 text-xs font-medium transition-all',
            atLimit && 'cursor-not-allowed text-muted-foreground/40',
            !atLimit && empty && 'text-red-500/70 hover:text-red-600',
            !atLimit &&
              !empty &&
              'rounded border border-dashed text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
          title={atLimit ? `Max. ${MAX_TODOS_PER_WEEK} Aufgaben pro Woche` : 'Aufgabe hinzufügen'}
        >
          <Plus className="h-3 w-3" />
          {atLimit ? `${todos.length}/${MAX_TODOS_PER_WEEK}` : 'Aufgabe'}
        </button>
      )}
    </div>
  )
}

function StateCycle({ state, onChange }: { state: TodoState; onChange: (s: TodoState) => void }) {
  const Icon = state === 'erledigt' ? CircleCheck : state === 'inProgress' ? CircleDot : Circle
  const title =
    state === 'erledigt' ? 'Erledigt' : state === 'inProgress' ? 'In Bearbeitung' : 'Offen'
  return (
    <button
      type="button"
      aria-label={title}
      title={`${title} — klicken zum Weiterschalten`}
      onClick={() => onChange(nextTodoState(state))}
      className={cn(
        'mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded transition-colors',
        state === 'erledigt' && 'text-emerald-600',
        state === 'inProgress' && 'text-amber-600',
        state === 'offen' && 'text-muted-foreground/60 hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={state === 'offen' ? 1.5 : 2} />
    </button>
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
    <div className={cn('group flex flex-col gap-0.5 rounded px-1.5 py-0.5', tone ? TONE_CLASSES[tone] : 'hover:bg-muted')}>
      <div className="flex items-start gap-2">
        <StateCycle state={todo.state} onChange={(s) => onUpdate({ state: s })} />
        <textarea
          value={todo.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Aufgabe, Abgabe, Abstimmen, Urlaub, Pufferarbeiten…"
          rows={1}
          className={cn(
            'min-w-0 flex-1 resize-none bg-transparent text-xs leading-snug outline-none placeholder:text-muted-foreground/50',
            todo.state === 'erledigt' && 'line-through opacity-60',
          )}
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <button
          onClick={onRemove}
          className="mt-0.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          title="Löschen"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {isUrlaub && <UrlaubDayPicker days={todo.days ?? []} onChange={(days) => onUpdate({ days })} />}
      {!isUrlaub && (
        <ProgressRow
          value={todo.progress ?? 0}
          onChange={(progress) => onUpdate({ progress })}
        />
      )}
    </div>
  )
}

function ProgressRow({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="ml-6 flex items-center gap-2 pt-0.5">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded bg-muted accent-foreground"
        title={`${clamped} %`}
      />
      <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {clamped} %
      </span>
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
        <div className="space-y-1 border-t pt-2 text-[11px]">
          <div className="font-medium">Status</div>
          <div className="flex items-center gap-2">
            <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span>Offen</span>
          </div>
          <div className="flex items-center gap-2">
            <CircleDot className="h-3.5 w-3.5 text-amber-600" />
            <span>In Bearbeitung</span>
          </div>
          <div className="flex items-center gap-2">
            <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Erledigt</span>
          </div>
        </div>
        <div className="pt-1 text-muted-foreground">
          Zeile färbt sich automatisch anhand des Schlüsselworts. Abgelaufene Wochen sind gesperrt.
        </div>
      </div>
    </InfoTooltip>
  )
}
