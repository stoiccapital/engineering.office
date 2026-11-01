import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { NumCell } from './NumCell'
import { TextCell } from './TextCell'
import { LoadingCard } from '@/components/ui/loading-card'
import { useZiele, computeTeamTargets, teamFTE, type TeamTargets } from '@/ziele-store'
import type { ZieleBranch, ZieleTeam } from '@/types'
import { fmtEUR } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Ziele() {
  const ziele = useZiele((s) => s.ziele)
  if (!ziele) return <LoadingCard>Lade Ziele…</LoadingCard>
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {ziele.branches.map((b) => (
        <BranchBlock key={b.id} branch={b} />
      ))}
    </div>
  )
}

function BranchBlock({ branch }: { branch: ZieleBranch }) {
  const updateBranch = useZiele((s) => s.updateBranch)
  const addTeam = useZiele((s) => s.addTeam)

  const totalFTE = useMemo(
    () => branch.teams.reduce((s, t) => s + teamFTE(t), 0),
    [branch.teams],
  )
  const branchTotals = useMemo<TeamTargets>(() => {
    const t: TeamTargets = {
      fte: 0,
      umsatzJahr: 0,
      umsatzQuartal: 0,
      umsatzMonat: 0,
      akquiseJahr: 0,
      akquiseQuartal: 0,
      akquiseMonat: 0,
    }
    for (const team of branch.teams) {
      const tt = computeTeamTargets(team, branch)
      t.fte += tt.fte
      t.umsatzJahr += tt.umsatzJahr
      t.umsatzQuartal += tt.umsatzQuartal
      t.umsatzMonat += tt.umsatzMonat
      t.akquiseJahr += tt.akquiseJahr
      t.akquiseQuartal += tt.akquiseQuartal
      t.akquiseMonat += tt.akquiseMonat
    }
    return t
  }, [branch])

  return (
    <Section
      title={branch.label}
      subtitle={`${totalFTE.toFixed(2)} FTE · ${branch.teams.length} Teams`}
      action={
        <button
          onClick={() => addTeam(branch.id)}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Team
        </button>
      }
    >
      <div className="space-y-4">
        <BranchConfig branch={branch} onChange={(patch) => updateBranch(branch.id, patch)} />
        {branch.teams.map((team) => (
          <TeamBlock key={team.id} branch={branch} team={team} />
        ))}
        <BranchTotals totals={branchTotals} />
      </div>
    </Section>
  )
}

function BranchConfig({
  branch,
  onChange,
}: {
  branch: ZieleBranch
  onChange: (patch: Partial<Pick<ZieleBranch, 'umsatzProFTE' | 'ruhendePct'>>) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
      <ConfigRow label="Umsatz pro FTE / Jahr">
        <NumCell value={branch.umsatzProFTE} onChange={(v) => onChange({ umsatzProFTE: v ?? 0 })} />
      </ConfigRow>
      <ConfigRow label="Ruhende Projekte">
        <NumCell value={branch.ruhendePct} onChange={(v) => onChange({ ruhendePct: v ?? 0 })} pct />
      </ConfigRow>
    </div>
  )
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="min-w-[140px]">{children}</div>
    </label>
  )
}

function TeamBlock({ branch, team }: { branch: ZieleBranch; team: ZieleTeam }) {
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
            onChange={(e) => renameTeam(branch.id, team.id, e.target.value)}
            className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-sm font-semibold outline-none focus:bg-background focus:ring-1 focus:ring-ring"
          />
          <span className="font-mono text-xs text-muted-foreground">
            {targets.fte.toFixed(2)} FTE
          </span>
        </div>
        <button
          onClick={() => removeTeam(branch.id, team.id)}
          className="rounded-md p-1 text-muted-foreground/40 hover:bg-accent hover:text-destructive"
          title="Team entfernen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/10">
            <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
              Mitarbeiter
            </th>
            <th className="num w-24 px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">
              FTE
            </th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {team.people.map((p) => (
            <tr key={p.id} className="group border-b last:border-b-0 hover:bg-accent/30">
              <td>
                <TextCell
                  value={p.name}
                  onChange={(v) => updatePerson(branch.id, team.id, p.id, { name: v })}
                  placeholder="Name"
                />
              </td>
              <td>
                <NumCell
                  value={p.fte}
                  onChange={(v) => updatePerson(branch.id, team.id, p.id, { fte: v ?? 0 })}
                  className="text-right"
                />
              </td>
              <td className="w-8 pr-1">
                <button
                  onClick={() => removePerson(branch.id, team.id, p.id)}
                  className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  title="Zeile löschen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="p-0">
              <button
                onClick={() => addPerson(branch.id, team.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                Mitarbeiter hinzufügen
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <TeamTargetsGrid targets={targets} />
    </div>
  )
}

function TeamTargetsGrid({ targets }: { targets: TeamTargets }) {
  const umsatz = [
    { label: 'Jahr', v: targets.umsatzJahr },
    { label: 'Quartal', v: targets.umsatzQuartal },
    { label: 'Monat', v: targets.umsatzMonat },
  ]
  const akquise = [
    { label: 'Jahr', v: targets.akquiseJahr },
    { label: 'Quartal', v: targets.akquiseQuartal },
    { label: 'Monat', v: targets.akquiseMonat },
  ]
  return (
    <div className="grid grid-cols-2 gap-px border-t bg-border">
      <TargetGroup title="Umsatzziel" items={umsatz} />
      <TargetGroup title="Akquiseziel" items={akquise} tone="accent" />
    </div>
  )
}

function TargetGroup({
  title,
  items,
  tone,
}: {
  title: string
  items: { label: string; v: number }[]
  tone?: 'accent'
}) {
  return (
    <div className={cn('bg-card p-3', tone === 'accent' && 'bg-muted/20')}>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {item.label}
            </div>
            <div className="num tabular-nums text-sm font-semibold">
              {fmtEUR(item.v)} €
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BranchTotals({ totals }: { totals: TeamTargets }) {
  return (
    <div className="rounded-md border bg-foreground/5 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider">Niederlassung — Summe</div>
        <div className="font-mono text-xs text-muted-foreground">{totals.fte.toFixed(2)} FTE</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TotalCol label="Umsatzziel" jahr={totals.umsatzJahr} quartal={totals.umsatzQuartal} monat={totals.umsatzMonat} />
        <TotalCol label="Akquiseziel" jahr={totals.akquiseJahr} quartal={totals.akquiseQuartal} monat={totals.akquiseMonat} />
      </div>
    </div>
  )
}

function TotalCol({
  label,
  jahr,
  quartal,
  monat,
}: {
  label: string
  jahr: number
  quartal: number
  monat: number
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="space-y-0.5 text-sm">
        <TotalLine label="Jahr" v={jahr} big />
        <TotalLine label="Quartal" v={quartal} />
        <TotalLine label="Monat" v={monat} />
      </div>
    </div>
  )
}

function TotalLine({ label, v, big }: { label: string; v: number; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('num tabular-nums', big ? 'text-base font-semibold' : 'text-sm')}>
        {fmtEUR(v)} €
      </span>
    </div>
  )
}
