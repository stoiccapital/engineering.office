import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { usePlan } from '@/plan-store'
import type { WeekTodo } from '@/types'
import { MONTH_LABELS_DE, monthOfISOWeek } from '@/lib/iso-week'
import { Section } from '@/components/ui/section'
import { Num } from '@/components/ui/num'
import { Check, X } from 'lucide-react'

type PendingItem = {
  empIndex: number
  empName: string
  empBranch: string
  week: number
  month: number
  todo: WeekTodo
}

export function Freigaben() {
  const year = usePlan((s) => s.year)
  const plan = usePlan((s) => s.plan)
  const updateTodo = usePlan((s) => s.updateTodo)
  const [rejectFor, setRejectFor] = useState<PendingItem | null>(null)

  const pending: PendingItem[] = useMemo(() => {
    if (!plan) return []
    const out: PendingItem[] = []
    for (const [key, todos] of Object.entries(plan.todos ?? {})) {
      const [eStr, wStr] = key.split(':')
      const empIndex = Number(eStr)
      const week = Number(wStr)
      const emp = plan.employees[empIndex]
      if (!emp) continue
      for (const t of todos) {
        if (t.state === 'zurFreigabe') {
          out.push({
            empIndex,
            empName: emp.name || 'Unbenannt',
            empBranch: emp.branch,
            week,
            month: monthOfISOWeek(year, week),
            todo: t,
          })
        }
      }
    }
    out.sort((a, b) =>
      a.week !== b.week ? a.week - b.week : a.empName.localeCompare(b.empName),
    )
    return out
  }, [plan, year])

  if (!plan) return null

  function approve(item: PendingItem) {
    updateTodo(item.empIndex, item.week, item.todo.id, {
      state: 'erledigt',
      rejectReason: undefined,
    })
  }

  return (
    <>
      <Section
        title="Freigaben"
        subtitle={
          <>
            <Num>{pending.length}</Num>{' '}
            {pending.length === 1 ? 'Aufgabe wartet' : 'Aufgaben warten'} auf Freigabe ·{' '}
            <Num>{year}</Num>
          </>
        }
        padded={false}
      >
        {pending.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Keine offenen Freigaben.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Mitarbeiter
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  KW
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Aufgabe
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Fortschritt
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody>
              {pending.map((item) => (
                <tr key={`${item.empIndex}:${item.week}:${item.todo.id}`} className="border-b last:border-b-0">
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>{item.empName}</span>
                      <span className="rounded border bg-muted/60 px-1 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                        {item.empBranch}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[11px] text-muted-foreground">KW</span>
                      <span className="num text-sm font-semibold tabular-nums">{item.week}</span>
                      <span className="text-[11px] text-muted-foreground">
                        · {MONTH_LABELS_DE[item.month]}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top text-sm">
                    {item.todo.text || <em className="text-muted-foreground/60">unbenannt</em>}
                  </td>
                  <td className="px-3 py-3 text-right align-top font-mono tabular-nums text-xs">
                    {item.todo.progress ?? 0} %
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => approve(item)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        title="Freigeben"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Freigeben
                      </button>
                      <button
                        onClick={() => setRejectFor(item)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                        title="Ablehnen"
                      >
                        <X className="h-3.5 w-3.5" />
                        Ablehnen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <RejectDialog
        item={rejectFor}
        onCancel={() => setRejectFor(null)}
        onConfirm={(reason) => {
          if (!rejectFor) return
          updateTodo(rejectFor.empIndex, rejectFor.week, rejectFor.todo.id, {
            state: 'inProgress',
            rejectReason: reason,
          })
          setRejectFor(null)
        }}
      />
    </>
  )
}

function RejectDialog({
  item,
  onConfirm,
  onCancel,
}: {
  item: PendingItem | null
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const key = item ? `${item.empIndex}:${item.week}:${item.todo.id}` : ''
  useEffect(() => {
    setReason('')
  }, [key])

  const trimmed = reason.trim()
  return (
    <Dialog.Root open={!!item} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background shadow-xl">
          <div className="border-b px-5 py-4">
            <Dialog.Title className="text-sm font-semibold">Aufgabe ablehnen</Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              „{item?.todo.text || 'Aufgabe'}" geht an {item?.empName} zurück. Grund erforderlich.
            </Dialog.Description>
          </div>
          <div className="space-y-2 px-5 py-4">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="reject-reason">
              Grund
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Was fehlt oder muss überarbeitet werden?"
              rows={4}
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
            <button
              onClick={onCancel}
              className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              onClick={() => onConfirm(trimmed)}
              disabled={!trimmed}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ablehnen
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
