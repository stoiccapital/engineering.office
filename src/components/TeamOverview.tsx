import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
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
import { Num } from '@/components/ui/num'
import { StateCycle } from '@/components/ui/state-cycle'

const LOOKAHEAD_WEEKS = 6

const STATUS_BADGE: Record<PlanStatus, string> = {
  abstimmen: 'bg-amber-100 text-amber-900',
  urlaub: 'bg-sky-100 text-sky-900',
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

  const subtitle = (
    <>
      <Num>{plan.employees.length}</Num> Mitarbeiter · KW{' '}
      <Num>{weeks[0]?.week ?? '—'}</Num>–<Num>{weeks[weeks.length - 1]?.week ?? '—'}</Num>
    </>
  )

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
          <thead className="sticky top-0 z-20 bg-muted">
            <tr className="border-b">
              <th className="sticky left-0 z-30 min-w-[180px] bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground">
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
                      <span className="font-mono text-[11px]">KW</span>
                      <span className="num text-sm font-semibold tabular-nums">{week}</span>
                      <span className="text-[11px] text-muted-foreground">
                        · {MONTH_LABELS_DE[month]}
                      </span>
                      {isToday && (
                        <span className="ml-auto rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
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
            {plan.employees.map((emp, empIndex) => (
              <tr key={emp.id} className="border-b last:border-b-0">
                <td className="sticky left-0 z-10 min-w-[180px] border-r bg-background px-3 py-3 align-top">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span>{emp.name || 'Unbenannt'}</span>
                    <span className="rounded border bg-muted/60 px-1 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                      {emp.branch}
                    </span>
                  </div>
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
                      <WeekCell status={status} todos={todos} empIndex={empIndex} week={week} />
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
  empIndex,
  week,
}: {
  status: PlanStatus | undefined
  todos: WeekTodo[]
  empIndex: number
  week: number
}) {
  const updateTodo = usePlan((s) => s.updateTodo)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const openTodos = todos.filter((t) => t.state !== 'erledigt')
  const confirmTodo = confirmId ? openTodos.find((t) => t.id === confirmId) ?? null : null

  if (!status && todos.length === 0) {
    return <div className="text-xs text-muted-foreground/50">—</div>
  }

  function handleProgress(todo: WeekTodo, progress: number) {
    if (progress >= 100) {
      // Park at 100 % but keep it visible until the user confirms sending it off for validation.
      updateTodo(empIndex, week, todo.id, { progress: 100, state: 'inProgress' })
      setConfirmId(todo.id)
      return
    }
    updateTodo(empIndex, week, todo.id, {
      progress,
      state: progress > 0 ? 'inProgress' : 'offen',
    })
  }

  function confirmSubmit() {
    if (!confirmTodo) return
    // Submit to PM for validation; clear any previous rejection reason.
    updateTodo(empIndex, week, confirmTodo.id, {
      state: 'zurFreigabe',
      progress: 100,
      rejectReason: undefined,
    })
    setConfirmId(null)
  }

  function cancelSubmit() {
    setConfirmId(null)
  }

  function resubmit(todo: WeekTodo) {
    updateTodo(empIndex, week, todo.id, {
      state: 'zurFreigabe',
      progress: 100,
      rejectReason: undefined,
    })
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
        <ul className="space-y-2">
          {openTodos.map((todo) => {
            const isUrlaub = todo.text.toLowerCase().includes('urlaub')
            const pending = todo.state === 'zurFreigabe'
            const rejected = todo.state === 'inProgress' && !!todo.rejectReason
            return (
              <li key={todo.id} className="space-y-0.5 text-xs leading-snug text-foreground">
                <div className="flex items-start gap-1.5">
                  {!isUrlaub && <StateCycle state={todo.state} />}
                  <span className="min-w-0 flex-1 break-words">
                    {todo.text || <em className="text-muted-foreground/60">unbenannt</em>}
                  </span>
                </div>
                {pending && (
                  <div className="ml-4">
                    <span className="inline-flex items-center rounded bg-violet-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet-900">
                      In Prüfung
                    </span>
                  </div>
                )}
                {!isUrlaub && (
                  <ProgressSlider
                    value={todo.progress ?? 0}
                    disabled={pending}
                    onChange={(progress) => handleProgress(todo, progress)}
                  />
                )}
                {rejected && (
                  <div className="ml-4 mt-1 flex items-start gap-2 rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
                        Abgelehnt
                      </div>
                      <div className="mt-0.5 break-words text-[11px] text-foreground">
                        {todo.rejectReason}
                      </div>
                    </div>
                    <button
                      onClick={() => resubmit(todo)}
                      className="shrink-0 rounded-md border border-destructive/40 bg-background px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/10"
                      title="Erneut zur Freigabe senden"
                    >
                      Erneut senden
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : todos.length > 0 ? (
        <div className="text-[11px] text-muted-foreground">Alle Aufgaben erledigt</div>
      ) : null}

      <ConfirmSubmitDialog
        todo={confirmTodo}
        onConfirm={confirmSubmit}
        onCancel={cancelSubmit}
      />
    </div>
  )
}

function ConfirmSubmitDialog({
  todo,
  onConfirm,
  onCancel,
}: {
  todo: WeekTodo | null
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog.Root open={!!todo} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background shadow-xl">
          <div className="border-b px-5 py-4">
            <Dialog.Title className="text-sm font-semibold">
              Zur Freigabe senden?
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              „{todo?.text || 'Aufgabe'}" geht an den Projektleiter. Nach Freigabe gilt die Aufgabe als erledigt.
            </Dialog.Description>
          </div>
          <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
            <button
              onClick={onCancel}
              className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              onClick={onConfirm}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Zur Freigabe senden
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ProgressSlider({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="ml-4 flex items-center gap-2 pt-0.5">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={clamped}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          'h-1 flex-1 appearance-none rounded bg-muted accent-foreground',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
        title={disabled ? 'In Prüfung' : `${clamped} %`}
      />
      <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {clamped} %
      </span>
    </div>
  )
}
