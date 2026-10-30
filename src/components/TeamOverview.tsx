import { useEffect, useMemo, useState } from 'react'
import { usePlan, cellKey } from '@/plan-store'
import { PLAN_STATUS_LABELS, type PlanStatus, type WeekTodo } from '@/types'
import {
  MONTH_LABELS_DE,
  currentISOWeek,
  monthOfISOWeek,
  weeksInISOYear,
} from '@/lib/iso-week'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Section } from '@/components/ui/section'

const LOOKAHEAD_WEEKS = 6
const TODO_PREVIEW = 3

const STATUS_BADGE: Record<PlanStatus, string> = {
  abstimmen: 'bg-amber-100 text-amber-900',
  urlaub: 'bg-sky-100 text-sky-900',
  frei: 'bg-muted text-muted-foreground',
  abgabe: 'bg-destructive/15 text-destructive',
}

export function TeamOverview() {
  const year = usePlan((s) => s.year)
  const plan = usePlan((s) => s.plan)
  const [offset, setOffset] = useState(0)

  // Reset the window to current week whenever the selected year changes.
  useEffect(() => {
    setOffset(0)
  }, [year])

  const { weeks, todayWeek, startWeek, totalWeeks } = useMemo(() => {
    const total = weeksInISOYear(year)
    const today = currentISOWeek()
    const baseWeek = today.year === year ? Math.min(today.week, total) : 1
    const maxStart = Math.max(1, total - LOOKAHEAD_WEEKS + 1)
    const startWeek = Math.max(1, Math.min(baseWeek + offset, maxStart))
    const end = Math.min(startWeek + LOOKAHEAD_WEEKS - 1, total)
    const weeks: { week: number; month: number }[] = []
    for (let w = startWeek; w <= end; w++) {
      weeks.push({ week: w, month: monthOfISOWeek(year, w) })
    }
    return {
      weeks,
      todayWeek: today.year === year ? today.week : null,
      startWeek,
      totalWeeks: total,
    }
  }, [year, offset])

  if (!plan) return null

  const canGoBack = startWeek > 1
  const canGoForward = startWeek + LOOKAHEAD_WEEKS - 1 < totalWeeks
  const atToday = todayWeek !== null && weeks.some((w) => w.week === todayWeek) && offset === 0

  const subtitle = `${plan.employees.length} Mitarbeiter · KW ${weeks[0]?.week ?? '—'}–${
    weeks[weeks.length - 1]?.week ?? '—'
  }`

  return (
    <Section
      title="Team-Übersicht"
      subtitle={subtitle}
      padded={false}
      action={
        <WindowNav
          onBack={() => setOffset((o) => o - 1)}
          onForward={() => setOffset((o) => o + 1)}
          onToday={() => setOffset(0)}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          atToday={atToday}
          todayAvailable={todayWeek !== null}
        />
      }
    >
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-muted/40">
            <tr className="border-b">
              <th className="sticky left-0 z-30 min-w-[180px] bg-muted/40 px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Mitarbeiter
              </th>
              {weeks.map(({ week, month }) => {
                const isToday = week === todayWeek
                return (
                  <th
                    key={week}
                    className={cn(
                      'min-w-[220px] border-l px-3 py-2 text-left text-xs font-medium',
                      isToday ? 'bg-primary/10 text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] uppercase tracking-wider">KW</span>
                      <span className="num text-sm font-semibold tabular-nums">{week}</span>
                      <span className="text-[11px] text-muted-foreground">
                        · {MONTH_LABELS_DE[month]}
                      </span>
                      {isToday && (
                        <span className="ml-auto rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">
                          Heute
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {plan.employees.map((name, empIndex) => (
              <tr key={empIndex} className="border-b last:border-b-0">
                <td className="sticky left-0 z-10 min-w-[180px] border-r bg-background px-3 py-3 align-top">
                  <div className="text-sm font-semibold">{name || 'Unbenannt'}</div>
                </td>
                {weeks.map(({ week }) => {
                  const key = cellKey(empIndex, week)
                  const status = plan.cells[key]
                  const todos = plan.todos?.[key] ?? []
                  const isToday = week === todayWeek
                  return (
                    <td
                      key={week}
                      className={cn(
                        'min-w-[220px] border-l p-3 align-top',
                        isToday && 'bg-primary/5',
                      )}
                    >
                      <WeekCell status={status} todos={todos} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function WindowNav({
  onBack,
  onForward,
  onToday,
  canGoBack,
  canGoForward,
  atToday,
  todayAvailable,
}: {
  onBack: () => void
  onForward: () => void
  onToday: () => void
  canGoBack: boolean
  canGoForward: boolean
  atToday: boolean
  todayAvailable: boolean
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border bg-card p-1">
      <button
        onClick={onBack}
        disabled={!canGoBack}
        className={cn(
          'rounded p-1 transition-colors',
          canGoBack
            ? 'text-muted-foreground hover:bg-accent hover:text-foreground'
            : 'cursor-not-allowed text-muted-foreground/40',
        )}
        title="Eine Woche zurück"
        aria-label="Eine Woche zurück"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={onToday}
        disabled={!todayAvailable || atToday}
        className={cn(
          'rounded px-2 py-0.5 text-xs font-medium transition-colors',
          !todayAvailable || atToday
            ? 'cursor-not-allowed text-muted-foreground/40'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        title="Zur aktuellen Woche"
      >
        Heute
      </button>
      <button
        onClick={onForward}
        disabled={!canGoForward}
        className={cn(
          'rounded p-1 transition-colors',
          canGoForward
            ? 'text-muted-foreground hover:bg-accent hover:text-foreground'
            : 'cursor-not-allowed text-muted-foreground/40',
        )}
        title="Eine Woche vor"
        aria-label="Eine Woche vor"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function WeekCell({
  status,
  todos,
}: {
  status: PlanStatus | undefined
  todos: WeekTodo[]
}) {
  const openTodos = todos.filter((t) => !t.done)
  const preview = openTodos.slice(0, TODO_PREVIEW)
  const overflow = openTodos.length - preview.length

  if (!status && todos.length === 0) {
    return <div className="text-xs text-muted-foreground/50">—</div>
  }

  return (
    <div className="flex flex-col gap-2">
      {status && (
        <span
          className={cn(
            'inline-flex w-fit items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold',
            STATUS_BADGE[status],
          )}
        >
          {PLAN_STATUS_LABELS[status]}
        </span>
      )}
      {openTodos.length > 0 ? (
        <ul className="space-y-1">
          {preview.map((todo) => (
            <li
              key={todo.id}
              className="flex items-start gap-1.5 text-xs leading-snug text-foreground"
            >
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
              <span className="min-w-0 flex-1 break-words">
                {todo.text || <em className="text-muted-foreground/60">unbenannt</em>}
              </span>
            </li>
          ))}
          {overflow > 0 && (
            <li className="pl-3 text-[11px] text-muted-foreground">+{overflow} weitere</li>
          )}
        </ul>
      ) : todos.length > 0 ? (
        <div className="text-[11px] text-muted-foreground">Alle Aufgaben erledigt</div>
      ) : null}
    </div>
  )
}
