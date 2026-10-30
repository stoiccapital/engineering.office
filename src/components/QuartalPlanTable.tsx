import { useMemo } from 'react'
import { usePlan, cellKey } from '@/plan-store'
import {
  MAX_TODOS_PER_WEEK,
  PLAN_STATUSES,
  PLAN_STATUS_LABELS,
  type PlanStatus,
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
import { ChevronDown, Plus, X } from 'lucide-react'
import { Section } from '@/components/ui/section'

const STATUS_CLASSES: Record<PlanStatus, string> = {
  abstimmen: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
  urlaub: 'bg-sky-100 text-sky-900 hover:bg-sky-200',
  frei: 'bg-muted text-muted-foreground hover:bg-accent',
  abgabe: 'bg-destructive/15 text-destructive hover:bg-destructive/25',
}

function StatusSelect({
  status,
  onChange,
}: {
  status: PlanStatus | undefined
  onChange: (next: PlanStatus | null) => void
}) {
  return (
    <div className="relative">
      <select
        value={status ?? ''}
        onChange={(e) => onChange((e.target.value || null) as PlanStatus | null)}
        className={cn(
          'h-7 w-full cursor-pointer appearance-none border-0 bg-transparent pl-2 pr-6 font-mono text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
          status ? STATUS_CLASSES[status] : 'text-muted-foreground/60 hover:bg-accent',
        )}
        title={status ? PLAN_STATUS_LABELS[status] : 'Leer'}
      >
        <option value="">— Leer —</option>
        {PLAN_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PLAN_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2',
          status ? 'opacity-70' : 'opacity-40',
        )}
      />
    </div>
  )
}

export function QuartalPlanTable() {
  const year = usePlan((s) => s.year)
  const quarter = usePlan((s) => s.quarter)
  const plan = usePlan((s) => s.plan)
  const setCell = usePlan((s) => s.setCell)
  const renameEmployee = usePlan((s) => s.renameEmployee)
  const addEmployee = usePlan((s) => s.addEmployee)
  const removeEmployee = usePlan((s) => s.removeEmployee)
  const addTodo = usePlan((s) => s.addTodo)
  const updateTodo = usePlan((s) => s.updateTodo)
  const removeTodo = usePlan((s) => s.removeTodo)

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

  if (!plan) return null

  const todoCount = plan.todos
    ? Object.values(plan.todos).reduce((sum, list) => sum + list.length, 0)
    : 0
  const title = quarter === 'all' ? `Jahresplan ${year}` : `${quarter} ${year}`
  const subtitle = `${plan.employees.length} Mitarbeiter · ${weekRows.length} Wochen · ${todoCount} Aufgaben`

  return (
    <Section title={title} subtitle={subtitle} padded={false} footer={<PlanLegend />}>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-muted/40">
            <tr className="border-b">
              <th className="sticky left-0 z-30 w-16 bg-muted/40 px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Monat
              </th>
              <th className="sticky left-16 z-30 w-14 border-r bg-muted/40 px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                KW
              </th>
              {plan.employees.map((name, i) => (
                <th
                  key={i}
                  className="min-w-[280px] border-l px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                >
                  <div className="group flex items-center gap-1">
                    <input
                      value={name}
                      onChange={(e) => renameEmployee(i, e.target.value)}
                      className="w-full rounded bg-transparent px-1 py-0.5 text-sm font-semibold text-foreground outline-none focus:bg-background focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => removeEmployee(i)}
                      className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      title="Mitarbeiter entfernen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-10 border-l px-1 py-2">
                <button
                  onClick={addEmployee}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Mitarbeiter hinzufügen"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {weekRows.map((row) => {
              const isToday = row.week === todayWeek
              return (
                <tr
                  key={row.week}
                  className={cn('border-b last:border-b-0', isToday && 'bg-primary/5')}
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
                    )}
                  >
                    {row.week}
                  </td>
                  {plan.employees.map((_, empIndex) => {
                    const key = cellKey(empIndex, row.week)
                    const status = plan.cells[key]
                    const todos = plan.todos?.[key] ?? []
                    return (
                      <td key={empIndex} className="min-w-[280px] border-l p-0 align-top">
                        <StatusSelect
                          status={status}
                          onChange={(next) => setCell(empIndex, row.week, next)}
                        />
                        <WeekTodosCell
                          todos={todos}
                          onAdd={() => addTodo(empIndex, row.week)}
                          onUpdate={(id, patch) => updateTodo(empIndex, row.week, id, patch)}
                          onRemove={(id) => removeTodo(empIndex, row.week, id)}
                        />
                      </td>
                    )
                  })}
                  <td className="border-l align-top" />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function WeekTodosCell({
  todos,
  onAdd,
  onUpdate,
  onRemove,
}: {
  todos: WeekTodo[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<Omit<WeekTodo, 'id'>>) => void
  onRemove: (id: string) => void
}) {
  const atLimit = todos.length >= MAX_TODOS_PER_WEEK
  const empty = todos.length === 0
  return (
    <div className="group/cell flex flex-col gap-0.5 p-1.5">
      {todos.map((todo) => (
        <TodoRow
          key={todo.id}
          todo={todo}
          onUpdate={(patch) => onUpdate(todo.id, patch)}
          onRemove={() => onRemove(todo.id)}
        />
      ))}
      <button
        onClick={onAdd}
        disabled={atLimit}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-xs font-medium transition-all',
          atLimit && 'cursor-not-allowed text-muted-foreground/40',
          !atLimit && empty && 'text-muted-foreground/40 hover:text-foreground',
          !atLimit && !empty &&
            'rounded border border-dashed text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        title={atLimit ? `Max. ${MAX_TODOS_PER_WEEK} Aufgaben pro Woche` : 'Aufgabe hinzufügen'}
      >
        <Plus className="h-3 w-3" />
        {atLimit ? `${todos.length}/${MAX_TODOS_PER_WEEK}` : 'Aufgabe'}
      </button>
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
  return (
    <div className="group flex items-start gap-1.5 rounded px-1 py-0.5 hover:bg-muted/40">
      <input
        type="checkbox"
        checked={todo.done}
        onChange={(e) => onUpdate({ done: e.target.checked })}
        className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer accent-foreground"
      />
      <textarea
        value={todo.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        placeholder="Aufgabe…"
        rows={1}
        className={cn(
          'min-w-0 flex-1 resize-none bg-transparent text-xs leading-snug outline-none placeholder:text-muted-foreground/50',
          todo.done && 'text-muted-foreground line-through',
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
  )
}

const LEGEND_SWATCH: Record<PlanStatus, string> = {
  abstimmen: 'bg-amber-100 text-amber-900',
  urlaub: 'bg-sky-100 text-sky-900',
  frei: 'bg-muted text-muted-foreground',
  abgabe: 'bg-destructive/15 text-destructive',
}

function PlanLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="font-medium uppercase tracking-wider">Legende</span>
      {PLAN_STATUSES.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span
            className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] ${LEGEND_SWATCH[s]}`}
          >
            {PLAN_STATUS_LABELS[s]}
          </span>
        </span>
      ))}
      <span className="ml-auto">
        Status aus Dropdown wählen · Aufgaben inline bearbeiten · Änderungen werden automatisch
        gespeichert.
      </span>
    </div>
  )
}
