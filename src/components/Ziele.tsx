import { useMemo } from 'react'
import { Lock, LockOpen, Plus, Trash2 } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { NumCell } from './NumCell'
import { TextCell } from './TextCell'
import { LoadingCard } from '@/components/ui/loading-card'
import {
  addTeamTargets,
  computeBranchAllocations,
  computeTeamTargets,
  emptyTeamTargets,
  teamFTE,
  teamRevenueFTE,
  teamTeilungsschluesselFor,
  useZiele,
  type HalbjahrTargets,
  type HalbjahrView,
  type HalfSplit,
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
import { logActivity } from '@/activity-store'

// Dashboard page — read-only FTE pool summary. Lives under the Ziele sidebar
// group as its own sub-view.
export function ZieleDashboardPage() {
  const ziele = useZiele((s) => s.ziele)
  if (!ziele) return <LoadingCard>Lade Ziele…</LoadingCard>
  return (
    <div className="space-y-6">
      <DashboardSection />
    </div>
  )
}

// Teams page — Lock bar + per-branch editor (teams, people, Umsatz/FTE,
// Teilungsschlüssel). This is where the actual planning happens.
export function ZieleTeamsPage() {
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
          if (confirm('Ziele sperren? Niemand kann mehr Werte ändern.')) {
            lock(by)
            logActivity({ kind: 'action', action: 'ziele.lock' })
          }
        }}
        onUnlock={() => {
          if (confirm('Ziele entsperren?')) {
            unlock()
            logActivity({ kind: 'action', action: 'ziele.unlock' })
          }
        }}
      />

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
  const halbjahr = useZiele((s) => s.halbjahr)
  if (!ziele) return null
  const locked = !!ziele.locked
  return (
    <Section
      title="Dashboard"
      subtitle="Teilungsschlüssel · Verwaltung und Ausschreibung"
      padded={false}
    >
      <div className="grid gap-px bg-border md:grid-cols-2">
        {ziele.branches.map((b) => (
          <BranchDashboard key={b.id} branch={b} locked={locked} halbjahr={halbjahr} />
        ))}
      </div>
    </Section>
  )
}

type DashboardRow = {
  teamId: string
  teamName: string
  revenueFTE: number
  shareVerw: number
  shareAussch: number
  isAutoVerw: boolean
  isAutoAussch: boolean
  verwaltungAllocated: number
  ausschreibungAllocated: number
}

function BranchDashboard({
  branch,
  locked,
  halbjahr,
}: {
  branch: ZieleBranch
  locked: boolean
  halbjahr: HalbjahrView
}) {
  const updateTeilungsschluessel = useZiele((s) => s.updateTeilungsschluessel)

  const { rows, verwaltungTotal, ausschreibungTotal, revenueTotal, shareSumVerw, shareSumAussch, halfLabel } =
    useMemo(() => {
      const alloc = computeBranchAllocations(branch)
      // Pick which pool to display: filter respects Halbjahr view; "Jahr"
      // falls back to annual average so the dashboard stays scalar.
      const pickBranch = (annual: number, split: HalfSplit): number => {
        if (halbjahr === 'h1') return split.h1
        if (halbjahr === 'h2') return split.h2
        return annual
      }
      const verwaltung = pickBranch(alloc.verwaltung, alloc.verwaltungH)
      const ausschreibung = pickBranch(alloc.ausschreibung, alloc.ausschreibungH)
      const revenue = pickBranch(alloc.operative, alloc.operativeH)
      const halfLabel =
        halbjahr === 'h1' ? ' H1' : halbjahr === 'h2' ? ' H2' : ''
      const rs: DashboardRow[] = branch.teams.map((t) => {
        const revFTE =
          halbjahr === 'h1'
            ? teamRevenueFTE(t, 'h1')
            : halbjahr === 'h2'
              ? teamRevenueFTE(t, 'h2')
              : teamRevenueFTE(t)
        const shareVerw = teamTeilungsschluesselFor(t, alloc, 'verwaltung')
        const shareAussch = teamTeilungsschluesselFor(t, alloc, 'ausschreibung')
        return {
          teamId: t.id,
          teamName: t.name || 'Unbenannt',
          revenueFTE: revFTE,
          shareVerw,
          shareAussch,
          isAutoVerw: t.teilungsschluessel?.verwaltung === undefined,
          isAutoAussch: t.teilungsschluessel?.ausschreibung === undefined,
          verwaltungAllocated: verwaltung * shareVerw,
          ausschreibungAllocated: ausschreibung * shareAussch,
        }
      })
      return {
        rows: rs,
        verwaltungTotal: verwaltung,
        ausschreibungTotal: ausschreibung,
        revenueTotal: revenue,
        shareSumVerw: rs.reduce((s, r) => s + r.shareVerw, 0),
        shareSumAussch: rs.reduce((s, r) => s + r.shareAussch, 0),
        halfLabel,
      }
    }, [branch, halbjahr])

  const sumVerwOk = Math.abs(shareSumVerw - 1) < 0.001
  const sumAusschOk = Math.abs(shareSumAussch - 1) < 0.001

  // Per-team tiles use the same FTE definition as Zielkontrolle (teamFTE,
  // i.e. sum of every person on the team roster regardless of role) so the
  // headcount number matches across both views. FTE respects the halbjahr
  // selection so the tile and its Overhead-Allokation are in the same time
  // scale. Pure overhead teams (everyone role='verwaltung') are hidden.
  const teamTiles = branch.teams
    .filter((t) => {
      if (t.people.length === 0) return false
      return t.people.some((p) => (p.role ?? 'team') !== 'verwaltung')
    })
    .map((t) => {
      const row = rows.find((r) => r.teamId === t.id)
      const fte =
        halbjahr === 'h1'
          ? teamFTE(t, 'h1')
          : halbjahr === 'h2'
            ? teamFTE(t, 'h2')
            : teamFTE(t)
      return {
        id: t.id,
        name: t.name || 'Unbenannt',
        fte,
        overheadAlloc: row ? row.verwaltungAllocated + row.ausschreibungAllocated : 0,
      }
    })

  return (
    <div className="bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-sm font-semibold">{branch.label}</div>
        <div className="text-[11px] text-muted-foreground">
          FTE-Pools{halfLabel}
        </div>
      </div>

      {teamTiles.length > 0 && (
        <div
          className={cn(
            'mb-3 grid gap-2',
            teamTiles.length === 1
              ? 'grid-cols-1'
              : teamTiles.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3',
          )}
        >
          {teamTiles.map((t) => (
            <TeamTile
              key={t.id}
              name={t.name}
              fte={t.fte}
              overheadAlloc={t.overheadAlloc}
            />
          ))}
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-2 text-xs">
        <OverheadBadge label="Operative Teams" fte={revenueTotal} tone="emerald" prominent />
        <OverheadBadge label="Verwaltung" fte={verwaltungTotal} tone="blue" />
        <OverheadBadge label="Ausschreibung" fte={ausschreibungTotal} tone="violet" />
      </div>
      {rows.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">
          Keine operativen Teams vorhanden.
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
              <th className="num w-24 px-2 py-1.5 text-right text-[11px] font-medium text-muted-foreground">
                Schl. Verw.
              </th>
              <th className="num w-24 px-2 py-1.5 text-right text-[11px] font-medium text-muted-foreground">
                Schl. Aussch.
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
                <td className="num px-1 py-1 text-right">
                  {locked ? (
                    <div className="num px-2 py-1 text-right text-sm text-muted-foreground">
                      {fmtPct(r.shareVerw)}
                      {r.isAutoVerw && <span className="ml-1 text-[9px]">auto</span>}
                    </div>
                  ) : (
                    <NumCell
                      value={r.isAutoVerw ? null : r.shareVerw}
                      onChange={(v) =>
                        updateTeilungsschluessel(branch.id, r.teamId, 'verwaltung', v)
                      }
                      pct
                      placeholder={fmtPct(r.shareVerw)}
                      className={cn(
                        'text-right font-semibold',
                        r.isAutoVerw && 'text-muted-foreground',
                      )}
                    />
                  )}
                </td>
                <td className="num px-1 py-1 text-right">
                  {locked ? (
                    <div className="num px-2 py-1 text-right text-sm text-muted-foreground">
                      {fmtPct(r.shareAussch)}
                      {r.isAutoAussch && <span className="ml-1 text-[9px]">auto</span>}
                    </div>
                  ) : (
                    <NumCell
                      value={r.isAutoAussch ? null : r.shareAussch}
                      onChange={(v) =>
                        updateTeilungsschluessel(branch.id, r.teamId, 'ausschreibung', v)
                      }
                      pct
                      placeholder={fmtPct(r.shareAussch)}
                      className={cn(
                        'text-right font-semibold',
                        r.isAutoAussch && 'text-muted-foreground',
                      )}
                    />
                  )}
                </td>
                <td className="num px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {fmtDecimal(r.verwaltungAllocated, 2)}
                </td>
                <td className="num px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {fmtDecimal(r.ausschreibungAllocated, 2)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-foreground/20 font-semibold">
              <td colSpan={2} className="px-2 py-1.5 text-right text-[11px] text-muted-foreground">
                Σ Schlüssel
              </td>
              <td
                className={cn(
                  'num px-2 py-1.5 text-right font-mono tabular-nums',
                  !sumVerwOk && 'text-destructive',
                )}
                title={sumVerwOk ? undefined : 'Sollte 100 % sein, sonst wird Verwaltung ungleich verteilt.'}
              >
                {fmtPct(shareSumVerw)}
              </td>
              <td
                className={cn(
                  'num px-2 py-1.5 text-right font-mono tabular-nums',
                  !sumAusschOk && 'text-destructive',
                )}
                title={sumAusschOk ? undefined : 'Sollte 100 % sein, sonst wird Ausschreibung ungleich verteilt.'}
              >
                {fmtPct(shareSumAussch)}
              </td>
              <td className="num px-2 py-1.5 text-right font-mono tabular-nums">
                {fmtDecimal(verwaltungTotal * shareSumVerw, 2)}
              </td>
              <td className="num px-2 py-1.5 text-right font-mono tabular-nums">
                {fmtDecimal(ausschreibungTotal * shareSumAussch, 2)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

function TeamTile({
  name,
  fte,
  overheadAlloc,
}: {
  name: string
  fte: number
  overheadAlloc: number
}) {
  return (
    <div className="flex flex-col rounded border bg-background px-2.5 py-2">
      <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {name}
      </div>
      <div className="mt-0.5 font-mono text-base font-semibold tabular-nums">
        {fmtDecimal(fte, 2)} <span className="text-[10px] opacity-70">FTE</span>
      </div>
      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
        + {fmtDecimal(overheadAlloc, 2)}{' '}
        <span className="text-[10px]">Overhead-Allokation</span>
      </div>
    </div>
  )
}

function OverheadBadge({
  label,
  fte,
  tone,
  prominent,
}: {
  label: string
  fte: number
  tone: 'blue' | 'violet' | 'emerald'
  prominent?: boolean
}) {
  const classes =
    tone === 'blue'
      ? 'border-sky-500/30 bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200'
      : tone === 'violet'
        ? 'border-violet-500/30 bg-violet-50 text-violet-900 dark:bg-violet-500/10 dark:text-violet-200'
        : 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200'
  return (
    <div
      className={cn(
        'flex flex-col rounded border px-2 py-1.5',
        classes,
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </span>
      <span
        className={cn(
          'font-mono tabular-nums font-semibold',
          prominent ? 'text-base' : 'text-xs',
        )}
      >
        {fmtDecimal(fte, 2)} <span className="text-[10px] opacity-70">FTE</span>
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
  const updatePersonFTE = useZiele((s) => s.updatePersonFTE)

  const targets = useMemo(() => computeTeamTargets(team, branch), [team, branch])

  // FTE columns follow the Halbjahr filter: H1 → only H1 column; H2 → only H2;
  // Jahr → both columns side by side so the PM can tune mid-year schedule.
  const showH1 = halbjahr !== 'h2'
  const showH2 = halbjahr !== 'h1'
  const colSpan = 2 + (showH1 ? 1 : 0) + (showH2 ? 1 : 0) + 1

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={team.name}
            readOnly={locked}
            onChange={(e) => renameTeam(branch.id, team.id, e.target.value)}
            className={cn(
              'min-w-0 flex-1 rounded px-1 py-0.5 text-sm font-semibold outline-none',
              locked
                ? 'bg-transparent'
                : 'bg-foreground/[0.03] transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]',
            )}
          />
          <span className="font-mono text-xs text-muted-foreground">
            {halbjahr === 'h1'
              ? `${fmtDecimal(teamFTE(team, 'h1'), 2)} FTE H1`
              : halbjahr === 'h2'
                ? `${fmtDecimal(teamFTE(team, 'h2'), 2)} FTE H2`
                : `${fmtDecimal(teamFTE(team, 'h1'), 2)} / ${fmtDecimal(teamFTE(team, 'h2'), 2)} FTE H1/H2`}
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
            {showH1 && (
              <th className="num w-24 px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">
                FTE H1
              </th>
            )}
            {showH2 && (
              <th className="num w-24 px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">
                FTE H2
              </th>
            )}
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
                    className="w-full rounded-sm bg-foreground/[0.03] px-1 py-1 text-xs outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
                  >
                    <option value="team">Team</option>
                    <option value="ausschreibung">Ausschreibung</option>
                    <option value="verwaltung">Verwaltung</option>
                  </select>
                )}
              </td>
              {showH1 && (
                <td>
                  <NumCell
                    value={p.fte.h1}
                    readOnly={locked}
                    onChange={(v) => updatePersonFTE(branch.id, team.id, p.id, 'h1', v ?? 0)}
                    decimals={2}
                    className="text-right"
                  />
                </td>
              )}
              {showH2 && (
                <td>
                  <NumCell
                    value={p.fte.h2}
                    readOnly={locked}
                    onChange={(v) => updatePersonFTE(branch.id, team.id, p.id, 'h2', v ?? 0)}
                    decimals={2}
                    className="text-right"
                  />
                </td>
              )}
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
              <td colSpan={colSpan} className="p-0">
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

      {targets.operativeFTE.h1 + targets.operativeFTE.h2 > 0 ? (
        <TeamTargetsGrid targets={targets} halbjahr={halbjahr} />
      ) : (
        <div className="border-t bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">
          Overhead-Team · kein eigenes Ziel. FTE wird anteilig über den Teilungsschlüssel
          auf die operativen Teams verteilt.
        </div>
      )}
    </div>
  )
}

function TeamTargetsGrid({
  targets,
  halbjahr,
}: {
  targets: TeamTargets
  halbjahr: HalbjahrView
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t bg-muted/10 px-4 py-1.5 font-mono text-[10px] text-muted-foreground">
        {halbjahr === 'all' ? (
          <>
            <span>
              H1{' '}
              <span className="font-semibold text-foreground">
                {fmtDecimal(targets.effectiveFTE.h1, 2)}
              </span>
              {' · '}H2{' '}
              <span className="font-semibold text-foreground">
                {fmtDecimal(targets.effectiveFTE.h2, 2)}
              </span>{' '}
              Eff. FTE
            </span>
            <span>
              Operativ {fmtDecimal(targets.operativeFTE.h1, 2)} / {fmtDecimal(targets.operativeFTE.h2, 2)} ·{' '}
              <span className="text-sky-700 dark:text-sky-300">
                + Overhead {fmtDecimal(targets.overheadFTE.h1, 2)} /{' '}
                {fmtDecimal(targets.overheadFTE.h2, 2)}
              </span>
            </span>
          </>
        ) : (
          <>
            <span>
              <span className="font-semibold text-foreground">
                {fmtDecimal(
                  halbjahr === 'h1' ? targets.effectiveFTE.h1 : targets.effectiveFTE.h2,
                  2,
                )}
              </span>{' '}
              Eff. FTE {halbjahr === 'h1' ? 'H1' : 'H2'}
            </span>
            <span>
              {fmtDecimal(
                halbjahr === 'h1' ? targets.operativeFTE.h1 : targets.operativeFTE.h2,
                2,
              )}{' '}
              operativ ·{' '}
              <span className="text-sky-700 dark:text-sky-300">
                +{' '}
                {fmtDecimal(
                  halbjahr === 'h1' ? targets.overheadFTE.h1 : targets.overheadFTE.h2,
                  2,
                )}{' '}
                Overhead-Allokation
              </span>
            </span>
          </>
        )}
      </div>
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
    </>
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
