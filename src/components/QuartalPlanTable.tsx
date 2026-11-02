import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlan, cellKey } from '@/plan-store'
import { MAX_TODOS_PER_WEEK, type WeekTodo } from '@/types'
import {
  MONTH_LABELS_DE,
  currentISOWeek,
  monthOfISOWeek,
  quarterOfISOWeek,
  weeksInISOYear,
} from '@/lib/iso-week'
import { cn } from '@/lib/utils'
import { Maximize2, Minimize2, Plus, X } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Checkbox } from '@/components/ui/checkbox'

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

export function QuartalPlanTable() {
  const year = usePlan((s) => s.year)
  const quarter = usePlan((s) => s.quarter)
  const plan = usePlan((s) => s.plan)
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

  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void containerRef.current?.requestFullscreen()
    }
  }

  if (!plan) return null

  const todoCount = plan.todos
    ? Object.values(plan.todos).reduce((sum, list) => sum + list.length, 0)
    : 0
  const title = quarter === 'all' ? `Jahresplan ${year}` : `${quarter} ${year}`
  const subtitle = `${plan.employees.length} Mitarbeiter · ${weekRows.length} Wochen · ${todoCount} Aufgaben`

  return (
    <div
      ref={containerRef}
      className={cn(
        isFullscreen && 'flex h-screen w-screen flex-col bg-background p-4',
      )}
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
      <div className={cn('overflow-auto', isFullscreen && 'max-h-[calc(100vh-200px)]')}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-muted">
            <tr className="border-b">
              <th className="sticky left-0 z-30 w-16 bg-muted px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                Monat
              </th>
              <th className="sticky left-16 z-30 w-14 border-r bg-muted px-2 py-2 text-right text-xs font-medium text-muted-foreground">
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
                    const todos = plan.todos?.[key] ?? []
                    return (
                      <td key={empIndex} className="min-w-[280px] border-l p-0 align-top">
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
    </div>
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
    <div
      className={cn(
        'group/cell flex flex-col gap-0.5 p-1.5',
        empty && 'border-l-2 border-red-400/50',
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
      <button
        onClick={onAdd}
        disabled={atLimit}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-xs font-medium transition-all',
          atLimit && 'cursor-not-allowed text-muted-foreground/40',
          !atLimit && empty && 'text-red-500/70 hover:text-red-600',
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
  const tone = todoTone(todo.text)
  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded px-1.5 py-0.5',
        tone ? TONE_CLASSES[tone] : 'hover:bg-muted',
      )}
    >
      <Checkbox
        checked={todo.done}
        onChange={(done) => onUpdate({ done })}
        className="mt-0.5"
        aria-label={todo.text || 'Aufgabe'}
      />
      <textarea
        value={todo.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        placeholder="Aufgabe, Abgabe, Abstimmen, Urlaub, Pufferarbeiten…"
        rows={1}
        className={cn(
          'min-w-0 flex-1 resize-none bg-transparent text-xs leading-snug outline-none placeholder:text-muted-foreground/50',
          todo.done && 'line-through opacity-60',
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
              <span
                className={`inline-block px-1.5 py-0.5 font-mono text-[11px] ${LEGEND_CLASSES[item.tone]}`}
              >
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
        <div className="pt-1 text-muted-foreground">
          Zeile färbt sich automatisch anhand des Schlüsselworts. Leere Zellen rot markiert.
        </div>
      </div>
    </InfoTooltip>
  )
}
