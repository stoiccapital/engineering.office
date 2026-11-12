import { useEffect, useMemo, useState } from 'react'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { LoadingCard } from '@/components/ui/loading-card'
import { useActivity } from '@/activity-store'
import type { ActivityEvent, ActivityKind, ModuleId } from '@/types'
import { MODULE_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

const KIND_LABEL: Record<ActivityKind, string> = {
  login: 'Anmeldung',
  view: 'Modul geöffnet',
  action: 'Aktion',
}

const KIND_CHIP: Record<ActivityKind, string> = {
  login: 'bg-emerald-100 text-emerald-900 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200',
  view: 'bg-muted text-muted-foreground border-border',
  action: 'bg-amber-100 text-amber-900 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200',
}

const DAY_OPTIONS = [1, 7, 30, 90] as const

export function Aktivitaet() {
  const days = useActivity((s) => s.days)
  const setDays = useActivity((s) => s.setDays)
  const events = useActivity((s) => s.events)
  const status = useActivity((s) => s.status)
  const load = useActivity((s) => s.load)

  useEffect(() => {
    if (status === 'idle') void load()
  }, [status, load])

  const [userFilter, setUserFilter] = useState<string>('')
  const [kindFilter, setKindFilter] = useState<ActivityKind | 'all'>('all')

  const userOptions = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) set.add(e.user)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [events])

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (userFilter && e.user !== userFilter) return false
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false
      return true
    })
  }, [events, userFilter, kindFilter])

  const summary = useMemo(() => {
    const users = new Set<string>()
    let logins = 0
    for (const e of events) {
      users.add(e.user)
      if (e.kind === 'login') logins++
    }
    return { users: users.size, logins, total: events.length }
  }, [events])

  if (status === 'loading' && events.length === 0) {
    return <LoadingCard>Lade Aktivität…</LoadingCard>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Ereignisse" value={summary.total} />
        <StatCard label="Anmeldungen" value={summary.logins} />
        <StatCard label="Aktive Benutzer" value={summary.users} />
      </div>

      <Section
        title="Aktivität"
        subtitle={`Letzte ${days} ${days === 1 ? 'Tag' : 'Tage'} · nach Zeit absteigend`}
        padded={false}
        action={
          <div className="flex items-center gap-2">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Alle Benutzer</option>
              {userOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as ActivityKind | 'all')}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">Alle Ereignisse</option>
              <option value="login">Anmeldungen</option>
              <option value="view">Modul-Öffnungen</option>
              <option value="action">Aktionen</option>
            </select>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? 'Tag' : 'Tage'}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Neu laden
            </Button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-muted-foreground">
            Keine Ereignisse im gewählten Zeitraum.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-muted/60">
                <tr className="border-b text-muted-foreground">
                  <th className="w-40 px-3 py-2 text-left font-medium">Zeit</th>
                  <th className="w-32 px-3 py-2 text-left font-medium">Benutzer</th>
                  <th className="w-32 px-3 py-2 text-left font-medium">Ereignis</th>
                  <th className="px-3 py-2 text-left font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.ts + i} className="border-b last:border-b-0 hover:bg-accent/30">
                    <td className="px-3 py-1.5 font-mono tabular-nums text-muted-foreground">
                      {fmtTs(e.ts)}
                    </td>
                    <td className="px-3 py-1.5 font-mono">{e.user}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                          KIND_CHIP[e.kind],
                        )}
                      >
                        {KIND_LABEL[e.kind]}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {detailText(e)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
        {value}
      </div>
    </div>
  )
}

function fmtTs(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function detailText(e: ActivityEvent): string {
  if (e.kind === 'view' && e.module) {
    return MODULE_LABELS[e.module as ModuleId] ?? e.module
  }
  if (e.kind === 'action') {
    return e.target ? `${e.action} · ${e.target}` : (e.action ?? '')
  }
  if (e.kind === 'login') return 'angemeldet'
  return ''
}
