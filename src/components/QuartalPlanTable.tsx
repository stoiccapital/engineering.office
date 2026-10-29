import { useMemo } from 'react'
import { usePlan, cellKey } from '@/plan-store'
import { PLAN_STATUSES, PLAN_STATUS_LABELS, type PlanStatus } from '@/types'
import { MONTH_LABELS_DE, monthOfISOWeek, weeksInISOYear } from '@/lib/iso-week'
import { cn } from '@/lib/utils'
import { Plus, X } from 'lucide-react'
import { Section } from '@/components/ui/section'

const STATUS_CLASSES: Record<PlanStatus, string> = {
  abstimmen: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
  urlaub: 'bg-sky-100 text-sky-900 hover:bg-sky-200',
  frei: 'bg-muted text-muted-foreground hover:bg-accent',
  abgabe: 'bg-destructive/15 text-destructive hover:bg-destructive/25',
}

const STATUS_SHORT: Record<PlanStatus, string> = {
  abstimmen: 'A',
  urlaub: 'U',
  frei: 'F',
  abgabe: 'Ab',
}

function nextStatus(current: PlanStatus | undefined): PlanStatus | null {
  if (!current) return 'abstimmen'
  const idx = PLAN_STATUSES.indexOf(current)
  if (idx === PLAN_STATUSES.length - 1) return null
  return PLAN_STATUSES[idx + 1]
}

export function QuartalPlanTable() {
  const year = usePlan((s) => s.year)
  const plan = usePlan((s) => s.plan)
  const setCell = usePlan((s) => s.setCell)
  const renameEmployee = usePlan((s) => s.renameEmployee)
  const addEmployee = usePlan((s) => s.addEmployee)
  const removeEmployee = usePlan((s) => s.removeEmployee)

  const weekRows = useMemo(() => {
    const total = weeksInISOYear(year)
    const rows: { week: number; month: number; firstOfMonth: boolean; monthSpan: number }[] = []
    for (let w = 1; w <= total; w++) {
      rows.push({ week: w, month: monthOfISOWeek(year, w), firstOfMonth: false, monthSpan: 0 })
    }
    let i = 0
    while (i < rows.length) {
      let j = i
      while (j < rows.length && rows[j].month === rows[i].month) j++
      rows[i].firstOfMonth = true
      rows[i].monthSpan = j - i
      i = j
    }
    return rows
  }, [year])

  if (!plan) return null

  const subtitle = `${plan.employees.length} Mitarbeiter · ${weekRows.length} Wochen`

  return (
    <Section
      title="Jahresplan"
      subtitle={subtitle}
      padded={false}
      footer={<PlanLegend />}
    >
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/40">
            <tr className="border-b">
              <th className="w-16 px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Monat
              </th>
              <th className="w-14 px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                KW
              </th>
              {plan.employees.map((name, i) => (
                <th
                  key={i}
                  className="min-w-[140px] border-l px-2 py-2 text-left text-xs font-medium text-muted-foreground"
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
            {weekRows.map((row) => (
              <tr key={row.week} className="border-b last:border-b-0">
                {row.firstOfMonth && (
                  <td
                    rowSpan={row.monthSpan}
                    className="border-r bg-muted/30 px-2 py-1 align-top text-xs font-semibold text-muted-foreground"
                  >
                    {MONTH_LABELS_DE[row.month]}
                  </td>
                )}
                <td className="num border-r px-2 py-1 text-xs text-muted-foreground">
                  {row.week}
                </td>
                {plan.employees.map((_, empIndex) => {
                  const status = plan.cells[cellKey(empIndex, row.week)]
                  return (
                    <td key={empIndex} className="border-l p-0">
                      <button
                        onClick={() => setCell(empIndex, row.week, nextStatus(status))}
                        className={cn(
                          'h-7 w-full px-2 text-left font-mono text-xs transition-colors',
                          status
                            ? STATUS_CLASSES[status]
                            : 'text-muted-foreground/40 hover:bg-accent',
                        )}
                        title={status ? PLAN_STATUS_LABELS[status] : 'Leer'}
                      >
                        {status ? PLAN_STATUS_LABELS[status] : ''}
                        <span className="sr-only">{status ? STATUS_SHORT[status] : ''}</span>
                      </button>
                    </td>
                  )
                })}
                <td className="border-l" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
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
        Zelle klicken, um Status zu wechseln. Änderungen werden automatisch gespeichert.
      </span>
    </div>
  )
}
