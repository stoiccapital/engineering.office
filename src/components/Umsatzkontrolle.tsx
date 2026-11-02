import { Fragment, useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { NumCell } from './NumCell'
import { LoadingCard } from '@/components/ui/loading-card'
import { useUmsatz, type MetricKey } from '@/umsatz-store'
import type { MonthValues, UmsatzBranch, UmsatzTeam } from '@/types'
import {
  MONTH_LABELS,
  QUARTER_END_MONTH_INDEX,
  QUARTER_LABELS,
  addMonthValues,
  cumulativeMonthValues,
  quarterSum,
  subMonthValues,
  totalSum,
} from '@/lib/umsatz'
import { fmtEUR } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Umsatzkontrolle() {
  const data = useUmsatz((s) => s.data)
  const addTeam = useUmsatz((s) => s.addTeam)

  const teams = data?.teams ?? EMPTY_TEAMS
  const forecastTotal = useMemo(() => sumMetric(teams, 'forecast'), [teams])
  const rechnungenTotal = useMemo(() => sumMetric(teams, 'rechnungen'), [teams])
  const zielTotal = useMemo(() => sumMetric(teams, 'ziel'), [teams])
  const totalFte = useMemo(() => teams.reduce((s, t) => s + (t.fte || 0), 0), [teams])

  const diffByTeam = useMemo(
    () => teams.map((t) => ({ team: t, values: subMonthValues(t.rechnungen, t.ziel) })),
    [teams],
  )
  const diffTotal = useMemo(() => subMonthValues(rechnungenTotal, zielTotal), [rechnungenTotal, zielTotal])

  const abwFcByTeam = useMemo(
    () => teams.map((t) => ({ team: t, values: subMonthValues(t.rechnungen, t.forecast) })),
    [teams],
  )
  const abwFcTotal = useMemo(() => subMonthValues(rechnungenTotal, forecastTotal), [rechnungenTotal, forecastTotal])

  const pufferDE = useMemo(() => branchCumulative(diffByTeam, 'de'), [diffByTeam])
  const pufferPL = useMemo(() => branchCumulative(diffByTeam, 'pl'), [diffByTeam])

  if (!data) return <LoadingCard>Lade Umsatzkontrolle…</LoadingCard>

  return (
    <div className="space-y-6">
      <Section
        title="Zielkontrolle"
        subtitle={`${teams.length} Teams · ${totalFte.toFixed(2)} FTE gesamt`}
        padded={false}
        action={
          <button
            onClick={addTeam}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Team
          </button>
        }
      >
        <div className="space-y-6 p-4">
          <TeamsConfig teams={teams} />
          <MetricTable title="Forecast" metric="forecast" teams={teams} totals={forecastTotal} editable />
          <MetricTable
            title="Gestellte Rechnungen"
            metric="rechnungen"
            teams={teams}
            totals={rechnungenTotal}
            editable
            trailing={(t) => <RechnungenTrailing team={t} />}
            trailingTotalLabel="FTE Σ"
            trailingTotal={<RechnungenTotalTrailing teams={teams} total={totalSum(rechnungenTotal)} />}
          />
          <MetricTable title="Zielvorgaben" metric="ziel" teams={teams} totals={zielTotal} editable />
          <DerivedMetricTable
            title="Differenz (Rg. − Ziel)"
            teams={teams.map((t, i) => ({ name: t.name, values: diffByTeam[i].values, branch: t.branch }))}
            totals={diffTotal}
            colorDeltas
          />
          <PufferRows deValues={pufferDE} plValues={pufferPL} />
        </div>
      </Section>

      <Section title="Forecast Kontrolle" padded={false}>
        <div className="p-4">
          <DerivedMetricTable
            title="Abweichung Forecast (Rg. − Forecast)"
            teams={teams.map((t, i) => ({ name: t.name, values: abwFcByTeam[i].values, branch: t.branch }))}
            totals={abwFcTotal}
            colorDeltas
          />
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400/70" />
              Forecast überschritten (&gt; 20 k)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400/70" />
              Forecast unterschritten (&lt; −20 k)
            </span>
          </div>
        </div>
      </Section>
    </div>
  )
}

const EMPTY_TEAMS: UmsatzTeam[] = []

function sumMetric(teams: UmsatzTeam[], metric: MetricKey): MonthValues {
  let out: MonthValues = Array.from({ length: 12 }, () => null)
  for (const t of teams) out = addMonthValues(out, t[metric])
  return out
}

function branchCumulative(
  diffs: { team: UmsatzTeam; values: MonthValues }[],
  branch: UmsatzBranch,
): MonthValues {
  let combined: MonthValues = Array.from({ length: 12 }, () => null)
  for (const { team, values } of diffs) {
    if (team.branch !== branch) continue
    combined = addMonthValues(combined, values)
  }
  return cumulativeMonthValues(combined)
}

function TeamsConfig({ teams }: { teams: UmsatzTeam[] }) {
  const updateTeam = useUmsatz((s) => s.updateTeam)
  const removeTeam = useUmsatz((s) => s.removeTeam)
  return (
    <div className="rounded-md border bg-muted/20">
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Teams
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/20">
            <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Team</th>
            <th className="w-24 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">NL</th>
            <th className="num w-24 px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">FTE</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id} className="group border-b last:border-b-0">
              <td>
                <input
                  value={t.name}
                  onChange={(e) => updateTeam(t.id, { name: e.target.value })}
                  className="w-full bg-transparent px-2 py-1.5 text-sm font-medium outline-none focus:bg-accent/60"
                />
              </td>
              <td className="px-2">
                <select
                  value={t.branch}
                  onChange={(e) => updateTeam(t.id, { branch: e.target.value as UmsatzBranch })}
                  className="w-full rounded border bg-card px-1.5 py-1 text-xs outline-none"
                >
                  <option value="de">NL DE</option>
                  <option value="pl">NL PL</option>
                </select>
              </td>
              <td>
                <NumCell
                  value={t.fte}
                  onChange={(v) => updateTeam(t.id, { fte: v ?? 0 })}
                  className="text-right"
                />
              </td>
              <td className="w-8 pr-1">
                <button
                  onClick={() => removeTeam(t.id)}
                  className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  title="Team entfernen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MetricTable({
  title,
  metric,
  teams,
  totals,
  editable,
  trailing,
  trailingTotalLabel,
  trailingTotal,
}: {
  title: string
  metric: MetricKey
  teams: UmsatzTeam[]
  totals: MonthValues
  editable?: boolean
  trailing?: (team: UmsatzTeam) => React.ReactNode
  trailingTotalLabel?: string
  trailingTotal?: React.ReactNode
}) {
  const updateCell = useUmsatz((s) => s.updateCell)
  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <HeaderRow trailing={trailing ? trailingTotalLabel : undefined} />
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-b last:border-b-0 hover:bg-accent/20">
                <TeamNameCell name={team.name} />
                <MonthRow
                  values={team[metric]}
                  onChange={
                    editable
                      ? (idx, v) => updateCell(team.id, metric, idx, v)
                      : undefined
                  }
                />
                {trailing && <td className="border-l">{trailing(team)}</td>}
              </tr>
            ))}
            <tr className="border-t bg-muted/50 font-semibold">
              <TeamNameCell name={`Gesamt ${title}`} />
              <MonthRow values={totals} />
              {trailingTotal && <td className="border-l">{trailingTotal}</td>}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DerivedMetricTable({
  title,
  teams,
  totals,
  colorDeltas,
}: {
  title: string
  teams: { name: string; values: MonthValues; branch: UmsatzBranch }[]
  totals: MonthValues
  colorDeltas?: boolean
}) {
  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <HeaderRow />
          <tbody>
            {teams.map((team, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <TeamNameCell name={`Δ${team.name}`} />
                <MonthRow values={team.values} colorDeltas={colorDeltas} />
              </tr>
            ))}
            <tr className="border-t bg-muted/50 font-semibold">
              <TeamNameCell name="Σ Differenz" />
              <MonthRow values={totals} colorDeltas={colorDeltas} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PufferRows({
  deValues,
  plValues,
}: {
  deValues: MonthValues
  plValues: MonthValues
}) {
  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Verbleibender Puffer (kumuliert)
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <HeaderRow />
          <tbody>
            <tr className="border-b hover:bg-accent/20">
              <TeamNameCell name="Puffer NL DE" />
              <MonthRow values={deValues} colorDeltas />
            </tr>
            <tr className="hover:bg-accent/20">
              <TeamNameCell name="Puffer NL PL" />
              <MonthRow values={plValues} colorDeltas />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HeaderRow({ trailing }: { trailing?: string }) {
  return (
    <thead className="bg-muted/20">
      <tr className="border-b">
        <th className="sticky left-0 z-10 min-w-[180px] bg-muted/20 px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Team
        </th>
        {MONTH_LABELS.map((label, idx) => {
          const q = QUARTER_END_MONTH_INDEX.indexOf(idx as 2 | 5 | 8 | 11)
          return (
            <Fragment key={label}>
              <th className="num min-w-[72px] px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                {label}
              </th>
              {q !== -1 && (
                <th className="num min-w-[88px] border-l bg-muted/40 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {QUARTER_LABELS[q]}
                </th>
              )}
            </Fragment>
          )
        })}
        <th className="num min-w-[96px] border-l bg-muted/40 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Σ
        </th>
        {trailing && (
          <th className="num min-w-[120px] border-l bg-muted/40 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {trailing}
          </th>
        )}
      </tr>
    </thead>
  )
}

function TeamNameCell({ name }: { name: string }) {
  return (
    <td className="sticky left-0 z-10 min-w-[180px] whitespace-nowrap bg-card px-2 py-1.5 text-sm font-medium">
      {name}
    </td>
  )
}

function MonthRow({
  values,
  onChange,
  colorDeltas,
}: {
  values: MonthValues
  onChange?: (monthIndex: number, v: number | null) => void
  colorDeltas?: boolean
}) {
  const cells: React.ReactNode[] = []
  for (let i = 0; i < 12; i++) {
    cells.push(
      <td key={`m${i}`} className="px-0">
        {onChange ? (
          <NumCell
            value={values[i] ?? null}
            onChange={(v) => onChange(i, v)}
            className="text-right"
          />
        ) : (
          <ReadCell v={values[i] ?? null} colorDeltas={colorDeltas} />
        )}
      </td>,
    )
    const q = QUARTER_END_MONTH_INDEX.indexOf(i as 2 | 5 | 8 | 11)
    if (q !== -1) {
      cells.push(
        <td key={`q${q}`} className="border-l bg-muted/30 px-0">
          <ReadCell v={quarterSum(values, q as 0 | 1 | 2 | 3)} bold colorDeltas={colorDeltas} />
        </td>,
      )
    }
  }
  cells.push(
    <td key="sum" className="border-l bg-muted/40 px-0">
      <ReadCell v={totalSum(values)} bold colorDeltas={colorDeltas} />
    </td>,
  )
  return <>{cells}</>
}

function ReadCell({
  v,
  bold,
  colorDeltas,
}: {
  v: number | null
  bold?: boolean
  colorDeltas?: boolean
}) {
  if (v === null) {
    return (
      <div className="num px-2 py-1.5 text-right text-sm text-muted-foreground/30">—</div>
    )
  }
  const tone =
    colorDeltas && Math.abs(v) >= 20_000
      ? v > 0
        ? 'text-emerald-700 bg-emerald-50/60'
        : 'text-red-700 bg-red-50/60'
      : ''
  return (
    <div
      className={cn(
        'num px-2 py-1.5 text-right text-sm tabular-nums',
        bold && 'font-semibold',
        tone,
      )}
    >
      {fmtEUR(v)}
    </div>
  )
}

function RechnungenTrailing({ team }: { team: UmsatzTeam }) {
  const summe = totalSum(team.rechnungen)
  const perFte = team.fte > 0 ? summe / team.fte : null
  return (
    <div className="flex items-center justify-end gap-3 px-3 py-1.5 font-mono text-xs text-muted-foreground">
      <span>{team.fte.toFixed(2)} FTE</span>
      <span className="font-semibold text-foreground">
        {perFte !== null ? `${fmtEUR(perFte)} €/FTE` : '—'}
      </span>
    </div>
  )
}

function RechnungenTotalTrailing({ teams, total }: { teams: UmsatzTeam[]; total: number }) {
  const fte = teams.reduce((s, t) => s + (t.fte || 0), 0)
  const perFte = fte > 0 ? total / fte : null
  return (
    <div className="flex items-center justify-end gap-3 px-3 py-1.5 font-mono text-xs font-semibold">
      <span>{fte.toFixed(2)} FTE</span>
      <span>{perFte !== null ? `${fmtEUR(perFte)} €/FTE` : '—'}</span>
    </div>
  )
}
