import { useMemo } from 'react'
import { Lock, LockOpen, Plus, Trash2 } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { NumCell } from './NumCell'
import { TextCell } from './TextCell'
import { LoadingCard } from '@/components/ui/loading-card'
import {
  addTeamTargets,
  computeTeamTargets,
  emptyTeamTargets,
  teamFTE,
  teamOverheadFTE,
  teamRevenueFTE,
  useZiele,
  type HalbjahrTargets,
  type HalbjahrView,
  type TeamTargets,
} from '@/ziele-store'
import { useAccess } from '@/access-store'
import type {
  UmsatzProFTE,
  ZieleBranch,
  ZielePersonRole,
  ZieleTeam,
} from '@/types'
import { fmtDecimal, fmtEUR, fmtPct } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Ziele() {
  const ziele = useZiele((s) => s.ziele)
  const halbjahr = useZiele((s) => s.halbjahr)
  const lock = useZiele((s) => s.lock)
  const unlock = useZiele((s) => s.unlock)
  const currentRole = useAccess((s) => s.currentRole)
  const locked = !!ziele?.locked
  const canUnlock = currentRole?.modules.includes('plan') ?? false

  if (!ziele) return <LoadingCard>Lade Ziele…</LoadingCard>

  return (
    <div className="space-y-6">
      <LockBar
        locked={locked}
        lockedBy={ziele.lockedBy}
        lockedAt={ziele.lockedAt}
        canUnlock={canUnlock}
        onLock={() => {
          const by = currentRole?.name || 'Unbekannt'
          if (confirm('Ziele sperren? Niemand kann mehr Werte ändern.')) lock(by)
        }}
        onUnlock={() => {
          if (confirm('Ziele entsperren?')) unlock()
        }}
      />

      <DashboardSection />

      <div className="grid gap-6 lg:grid-cols-2">
        {ziele.branches.map((b) => (
          <BranchBlock key={b.id} branch={b} locked={locked} halbjahr={halbjahr} />
        ))}
      </div>
    </div>
  )
}

function LockBar({
  locked,
  lockedBy,
  lockedAt,
  canUnlock,
  onLock,
  onUnlock,
}: {
  locked: boolean
  lockedBy?: string
  lockedAt?: string
  canUnlock: boolean
  onLock: () => void
  onUnlock: () => void
}) {
  if (!locked) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-card px-4 py-2.5">
        <div className="text-xs text-muted-foreground">
          Ziele sind editierbar. Nach Abschluss sperren, damit niemand versehentlich Werte überschreibt.
        </div>
        <button
          onClick={onLock}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Lock className="h-3.5 w-3.5" />
          Sperren
        </button>
      </div>
    )
  }
  const stamp = lockedAt
    ? new Date(lockedAt).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : ''
  return (
    <div className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-50 px-4 py-2.5 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="flex items-center gap-2 text-xs">
        <Lock className="h-4 w-4" />
        <span className="font-semibold">Gesperrt</span>
        <span className="text-amber-900/80 dark:text-amber-200/70">
          von {lockedBy || 'Unbekannt'}
          {stamp ? ` · ${stamp}` : ''}
        </span>
      </div>
      {canUnlock ? (
        <button
          onClick={onUnlock}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-600/40 bg-background px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/30"
        >
          <LockOpen className="h-3.5 w-3.5" />
          Entsperren
        </button>
      ) : (
        <span className="text-[11px] text-amber-900/70 dark:text-amber-200/60">
          Entsperren nur durch Projektleiter
        </span>
      )}
    </div>
  )
}

function DashboardSection() {
  const ziele = useZiele((s) => s.ziele)
  if (!ziele) return null
  return (
    <Section title="Dashboard" subtitle="Teilungsschlüssel · Verwaltung und Ausschreibung" padded={false}>
      <div className="grid gap-px bg-border md:grid-cols-2">
        {ziele.branches.map((b) => (
          <BranchDashboard key={b.id} branch={b} />
        ))}
      </div>
    </Section>
  )
}

type DashboardRow = {
  teamId: string
  teamName: string
  revenueFTE: number
  share: number // 0..1
  verwaltungAllocated: number
  ausschreibungAllocated: number
}

function BranchDashboard({ branch }: { branch: ZieleBranch }) {
  const { rows, verwaltungTotal, ausschreibungTotal, revenueTotal } = useMemo(() => {
    const revTotal = branch.teams.reduce((s, t) => s + teamRevenueFTE(t), 0)
    const vTotal = branch.teams.reduce((s, t) => s + teamOverheadFTE(t, 'verwaltung'), 0)
    const aTotal = branch.teams.reduce((s, t) => s + teamOverheadFTE(t, 'ausschreibung'), 0)
    const rs: DashboardRow[] = branch.teams
      .map((t) => {
        const revFTE = teamRevenueFTE(t)
        const share = revTotal > 0 ? revFTE / revTotal : 0
        return {
          teamId: t.id,
          teamName: t.name || 'Unbenannt',
          revenueFTE: revFTE,
          share,
          verwaltungAllocated: vTotal * share,
          ausschreibungAllocated: aTotal * share,
        }
      })
      .filter((r) => r.revenueFTE > 0)
    return {
      rows: rs,
      verwaltungTotal: vTotal,
      ausschreibungTotal: aTotal,
      revenueTotal: revTotal,
    }
  }, [branch])

  return (
    <div className="bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-sm font-semibold">{branch.label}</div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {fmtDecimal(revenueTotal, 2)} FTE Umsatzteams
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-2 text-xs">
        <OverheadBadge label="Verwaltung" fte={verwaltungTotal} tone="blue" />
        <OverheadBadge label="Ausschreibung" fte={ausschreibungTotal} tone="violet" />
      </div>
      {rows.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">
          Keine Umsatzteams vorhanden.
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-1.5 text-left text-[11px] font-medium text-muted-foreground">
                Team
              </th>
              <th className="num px-2 py-1.5 text-right text-[11px] font-medium text-muted-foreground">
                FTE
              </th>
              <th className="num px-2 py-1.5 text-right text-[11px] font-medium text-muted-foreground">
                Schlüssel
              </th>
              <th className="num px-2 py-1.5 text-right text-[11px] font-medium text-muted-foreground">
                Verw.
              </th>
              <th className="num px-2 py-1.5 text-right text-[11px] font-medium text-muted-foreground">
                Ausschr.
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} className="border-b last:border-b-0">
                <td className="px-2 py-1.5">{r.teamName}</td>
                <td className="num px-2 py-1.5 text-right font-mono tabular-nums">
                  {fmtDecimal(r.revenueFTE, 2)}
                </td>
                <td className="num px-2 py-1.5 text-right font-mono tabular-nums font-semibold">
                  {fmtPct(r.share)}
                </td>
                <td className="num px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {fmtDecimal(r.verwaltungAllocated, 2)}
                </td>
                <td className="num px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {fmtDecimal(r.ausschreibungAllocated, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function OverheadBadge({
  label,
  fte,
  tone,
}: {
  label: string
  fte: number
  tone: 'blue' | 'violet'
}) {
  const classes =
    tone === 'blue'
      ? 'border-sky-500/30 bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200'
      : 'border-violet-500/30 bg-violet-50 text-violet-900 dark:bg-violet-500/10 dark:text-violet-200'
  return (
    <div className={cn('flex items-baseline justify-between rounded border px-2 py-1.5', classes)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      <span className="font-mono text-xs tabular-nums font-semibold">
        {fmtDecimal(fte, 2)} FTE
      </span>
    </div>
  )
}

function BranchBlock({
  branch,
  locked,
  halbjahr,
}: {
  branch: ZieleBranch
  locked: boolean
  halbjahr: HalbjahrView
}) {
  const updateBranch = useZiele((s) => s.updateBranch)
  const addTeam = useZiele((s) => s.addTeam)

  const totalFTE = useMemo(
    () => branch.teams.reduce((s, t) => s + teamFTE(t), 0),
    [branch.teams],
  )
  const branchTotals = useMemo<TeamTargets>(() => {
    let acc = emptyTeamTargets()
    for (const team of branch.teams) acc = addTeamTargets(acc, computeTeamTargets(team, branch))
    return acc
  }, [branch])

  return (
    <Section
      title={branch.label}
      subtitle={`${fmtDecimal(totalFTE, 2)} FTE · ${branch.teams.length} Teams`}
      action={
        !locked && (
          <button
            onClick={() => addTeam(branch.id)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Team
          </button>
        )
      }
    >
      <div className="space-y-4">
        <BranchConfig
          branch={branch}
          locked={locked}
          halbjahr={halbjahr}
          onChange={(patch) => updateBranch(branch.id, patch)}
        />
        {branch.teams.map((team) => (
          <TeamBlock key={team.id} branch={branch} team={team} locked={locked} halbjahr={halbjahr} />
        ))}
        <BranchTotals totals={branchTotals} halbjahr={halbjahr} />
      </div>
    </Section>
  )
}

function BranchConfig({
  branch,
  locked,
  halbjahr,
  onChange,
}: {
  branch: ZieleBranch
  locked: boolean
  halbjahr: HalbjahrView
  onChange: (patch: Partial<Pick<ZieleBranch, 'umsatzProFTE' | 'ruhendePct'>>) => void
}) {
  const setH = (half: 'h1' | 'h2', v: number | null) => {
    const next: UmsatzProFTE = { ...branch.umsatzProFTE, [half]: v ?? 0 }
    onChange({ umsatzProFTE: next })
  }
  const showH1 = halbjahr !== 'h2'
  const showH2 = halbjahr !== 'h1'
  const showJahr = halbjahr === 'all'
  return (
    <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
      {showH1 && (
        <ConfigRow label="Umsatz pro FTE · H1">
          <NumCell value={branch.umsatzProFTE.h1} readOnly={locked} onChange={(v) => setH('h1', v)} />
        </ConfigRow>
      )}
      {showH2 && (
        <ConfigRow label="Umsatz pro FTE · H2">
          <NumCell value={branch.umsatzProFTE.h2} readOnly={locked} onChange={(v) => setH('h2', v)} />
        </ConfigRow>
      )}
      <ConfigRow label="Ruhende Projekte">
        <NumCell
          value={branch.ruhendePct}
          readOnly={locked}
          onChange={(v) => onChange({ ruhendePct: v ?? 0 })}
          pct
        />
      </ConfigRow>
      {showJahr && (
        <ConfigRow label="Umsatz pro FTE · Jahr">
          <NumCell value={branch.umsatzProFTE.h1 + branch.umsatzProFTE.h2} readOnly />
        </ConfigRow>
      )}
    </div>
  )
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <div className="min-w-[140px]">{children}</div>
    </label>
  )
}

const ROLE_LABELS: Record<ZielePersonRole, string> = {
  team: 'Team',
  ausschreibung: 'Ausschreibung',
  verwaltung: 'Verwaltung',
}

function TeamBlock({
  branch,
  team,
  locked,
  halbjahr,
}: {
  branch: ZieleBranch
  team: ZieleTeam
  locked: boolean
  halbjahr: HalbjahrView
}) {
  const renameTeam = useZiele((s) => s.renameTeam)
  const removeTeam = useZiele((s) => s.removeTeam)
  const addPerson = useZiele((s) => s.addPerson)
  const removePerson = useZiele((s) => s.removePerson)
  const updatePerson = useZiele((s) => s.updatePerson)

  const targets = useMemo(() => computeTeamTargets(team, branch), [team, branch])

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={team.name}
            readOnly={locked}
            onChange={(e) => renameTeam(branch.id, team.id, e.target.value)}
            className={cn(
              'min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-sm font-semibold outline-none',
              !locked && 'focus:bg-background focus:ring-1 focus:ring-ring',
            )}
          />
          <span className="font-mono text-xs text-muted-foreground">
            {fmtDecimal(targets.fte, 2)} FTE
          </span>
        </div>
        {!locked && (
          <button
            onClick={() => removeTeam(branch.id, team.id)}
            className="rounded-md p-1 text-muted-foreground/40 hover:bg-accent hover:text-destructive"
            title="Team entfernen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/10">
            <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
              Mitarbeiter
            </th>
            <th className="w-28 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
              Rolle
            </th>
            <th className="num w-24 px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">
              FTE
            </th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {team.people.map((p) => (
            <tr key={p.id} className="group border-b last:border-b-0 hover:bg-accent">
              <td>
                <TextCell
                  value={p.name}
                  readOnly={locked}
                  onChange={(v) => updatePerson(branch.id, team.id, p.id, { name: v })}
                  placeholder="Name"
                />
              </td>
              <td className="px-2 py-1">
                {locked ? (
                  <div className="text-xs text-muted-foreground">{ROLE_LABELS[p.role ?? 'team']}</div>
                ) : (
                  <select
                    value={p.role ?? 'team'}
                    onChange={(e) =>
                      updatePerson(branch.id, team.id, p.id, {
                        role: e.target.value as ZielePersonRole,
                      })
                    }
                    className="w-full rounded-sm bg-transparent px-1 py-1 text-xs outline-none focus:bg-accent/60"
                  >
                    <option value="team">Team</option>
                    <option value="ausschreibung">Ausschreibung</option>
                    <option value="verwaltung">Verwaltung</option>
                  </select>
                )}
              </td>
              <td>
                <NumCell
                  value={p.fte}
                  readOnly={locked}
                  onChange={(v) => updatePerson(branch.id, team.id, p.id, { fte: v ?? 0 })}
                  decimals={2}
                  className="text-right"
                />
              </td>
              <td className="w-8 pr-1">
                {!locked && (
                  <button
                    onClick={() => removePerson(branch.id, team.id, p.id)}
                    className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    title="Zeile löschen"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!locked && (
            <tr>
              <td colSpan={4} className="p-0">
                <button
                  onClick={() => addPerson(branch.id, team.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  Mitarbeiter hinzufügen
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <TeamTargetsGrid targets={targets} halbjahr={halbjahr} />
    </div>
  )
}

function TeamTargetsGrid({ targets, halbjahr }: { targets: TeamTargets; halbjahr: HalbjahrView }) {
  return (
    <div className="grid grid-cols-2 gap-px border-t bg-border">
      <TargetHalfGroup
        title="Umsatzziel"
        h1={targets.umsatz.h1}
        h2={targets.umsatz.h2}
        jahr={targets.umsatz.jahr}
        halbjahr={halbjahr}
      />
      <TargetHalfGroup
        title="Akquiseziel"
        h1={targets.akquise.h1}
        h2={targets.akquise.h2}
        jahr={targets.akquise.jahr}
        halbjahr={halbjahr}
        tone="accent"
      />
    </div>
  )
}

function TargetHalfGroup({
  title,
  h1,
  h2,
  jahr,
  halbjahr,
  tone,
}: {
  title: string
  h1: HalbjahrTargets
  h2: HalbjahrTargets
  jahr: number
  halbjahr: HalbjahrView
  tone?: 'accent'
}) {
  const showH1 = halbjahr !== 'h2'
  const showH2 = halbjahr !== 'h1'
  const showJahr = halbjahr === 'all'
  const headlineValue = halbjahr === 'h1' ? h1.halbjahr : halbjahr === 'h2' ? h2.halbjahr : jahr
  const headlineLabel = halbjahr === 'h1' ? 'H1' : halbjahr === 'h2' ? 'H2' : 'Jahr'
  return (
    <div className={cn('bg-card p-3', tone === 'accent' && 'bg-muted/20')}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <div className="text-[10px] font-semibold text-muted-foreground">{title}</div>
        <div className="num text-xs font-mono tabular-nums font-semibold">
          {fmtEUR(headlineValue)} €{' '}
          <span className="text-[9px] font-normal text-muted-foreground">{headlineLabel}</span>
        </div>
      </div>
      <div className={cn('grid gap-2', showH1 && showH2 ? 'grid-cols-2' : 'grid-cols-1')}>
        {showH1 && <HalfColumn label="H1" t={h1} />}
        {showH2 && <HalfColumn label="H2" t={h2} />}
      </div>
      {showJahr && (
        <div className="mt-2 flex items-baseline justify-between border-t pt-1.5 text-[10px]">
          <span className="font-medium text-muted-foreground">Jahr gesamt</span>
          <span className="num font-mono tabular-nums font-semibold">{fmtEUR(jahr)} €</span>
        </div>
      )}
    </div>
  )
}

function HalfColumn({ label, t }: { label: string; t: HalbjahrTargets }) {
  return (
    <div className="rounded border bg-background/50 p-2">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-semibold text-muted-foreground">{label}</span>
        <span className="num text-sm font-mono tabular-nums font-semibold">{fmtEUR(t.halbjahr)} €</span>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Quartal</span>
        <span className="num font-mono tabular-nums">{fmtEUR(t.quartal)} €</span>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Monat</span>
        <span className="num font-mono tabular-nums">{fmtEUR(t.monat)} €</span>
      </div>
    </div>
  )
}

function BranchTotals({
  totals,
  halbjahr,
}: {
  totals: TeamTargets
  halbjahr: HalbjahrView
}) {
  return (
    <div className="rounded-md border bg-foreground/5 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-xs font-semibold">Niederlassung — Summe</div>
        <div className="font-mono text-xs text-muted-foreground">
          {fmtDecimal(totals.fte, 2)} FTE
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TotalCol
          label="Umsatzziel"
          h1={totals.umsatz.h1.halbjahr}
          h2={totals.umsatz.h2.halbjahr}
          jahr={totals.umsatz.jahr}
          halbjahr={halbjahr}
        />
        <TotalCol
          label="Akquiseziel"
          h1={totals.akquise.h1.halbjahr}
          h2={totals.akquise.h2.halbjahr}
          jahr={totals.akquise.jahr}
          halbjahr={halbjahr}
        />
      </div>
    </div>
  )
}

function TotalCol({
  label,
  h1,
  h2,
  jahr,
  halbjahr,
}: {
  label: string
  h1: number
  h2: number
  jahr: number
  halbjahr: HalbjahrView
}) {
  const headlineLabel = halbjahr === 'h1' ? 'H1' : halbjahr === 'h2' ? 'H2' : 'Jahr'
  const headlineValue = halbjahr === 'h1' ? h1 : halbjahr === 'h2' ? h2 : jahr
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className="space-y-0.5 text-sm">
        <TotalLine label={headlineLabel} v={headlineValue} big />
        {halbjahr === 'all' && <TotalLine label="H1" v={h1} />}
        {halbjahr === 'all' && <TotalLine label="H2" v={h2} />}
      </div>
    </div>
  )
}

function TotalLine({ label, v, big }: { label: string; v: number; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('num tabular-nums font-mono', big ? 'text-base font-semibold' : 'text-sm')}>
        {fmtEUR(v)} €
      </span>
    </div>
  )
}
