import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { NumCell } from './NumCell'
import { LoadingCard } from '@/components/ui/loading-card'
import { useUmsatz, type MetricKey, type QuarterView } from '@/umsatz-store'
import { useZiele } from '@/ziele-store'
import type { MonthValues, UmsatzBranch, UmsatzTeamView } from '@/types'
import {
  MONTH_LABELS,
  QUARTER_LABELS,
  addMonthValues,
  cumulativeMonthValues,
  mergeUmsatz,
  quarterSum,
  subMonthValues,
  totalSum,
} from '@/lib/umsatz'
import { fmtDecimal, fmtEUR } from '@/lib/format'
import { cn } from '@/lib/utils'

const HIGHLIGHT_THRESHOLD_EUR = 20_000

export function Umsatzkontrolle() {
  const data = useUmsatz((s) => s.data)
  const quarter = useUmsatz((s) => s.quarter)
  const umsatzYear = useUmsatz((s) => s.year)

  const ziele = useZiele((s) => s.ziele)
  const zieleYear = useZiele((s) => s.year)
  const setZieleYear = useZiele((s) => s.setYear)
  const loadZiele = useZiele((s) => s.load)

  useEffect(() => {
    if (zieleYear !== umsatzYear) setZieleYear(umsatzYear)
    else if (!ziele) void loadZiele()
  }, [umsatzYear, zieleYear, ziele, setZieleYear, loadZiele])

  const teams = useMemo(() => mergeUmsatz(ziele, data), [ziele, data])

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

  const filter = useMemo(() => quarterFilter(quarter), [quarter])

  if (!data || !ziele) return <LoadingCard>Lade Zielkontrolle…</LoadingCard>

  if (teams.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-xs text-muted-foreground">
        Keine Teams in Ziele für {umsatzYear}. Lege Teams in Ziele an, um Daten hier zu pflegen.
      </div>
    )
  }

  const visibleRechnungen = visibleSum(rechnungenTotal, filter.months)
  const visibleForecast = visibleSum(forecastTotal, filter.months)
  const visibleZiel = visibleSum(zielTotal, filter.months)
  const visibleDiff = visibleSum(diffTotal, filter.months)
  const visibleAbwFc = visibleSum(abwFcTotal, filter.months)
  const pufferDEEnd = lastNonNull(pufferDE, filter.months)
  const pufferPLEnd = lastNonNull(pufferPL, filter.months)

  const colorLegend = (
    <InfoTooltip>
      <div className="space-y-2">
        <div className="font-medium">Farbkodierung</div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          <span className="text-muted-foreground">Positiv ≥ {fmtEUR(HIGHLIGHT_THRESHOLD_EUR)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-destructive" />
          <span className="text-muted-foreground">Jede negative Abweichung</span>
        </div>
      </div>
    </InfoTooltip>
  )

  return (
    <div className="space-y-6">
      <CollapsibleSection
        title="Verbleibender Puffer (kumuliert)"
        summary={
          <>
            <span>NL DE {fmtDeltaShort(pufferDEEnd)}</span>
            <span className="text-border">·</span>
            <span>NL PL {fmtDeltaShort(pufferPLEnd)}</span>
          </>
        }
        action={colorLegend}
      >
        <table className="w-full border-collapse text-sm">
          <HeaderRow filter={filter} />
          <tbody>
            <tr className="border-b hover:bg-accent">
              <TeamNameCell name="Puffer NL DE" />
              <MonthRow values={pufferDE} filter={filter} colorDeltas />
            </tr>
            <tr className="hover:bg-accent">
              <TeamNameCell name="Puffer NL PL" />
              <MonthRow values={pufferPL} filter={filter} colorDeltas />
            </tr>
          </tbody>
        </table>
      </CollapsibleSection>

      <CollapsibleSection
        title="Abweichung Forecast"
        subtitle="Rechnungen − Forecast"
        summary={fmtDeltaShort(visibleAbwFc)}
      >
        <DerivedMetricTable
          teams={teams.map((t, i) => ({ name: t.name, values: abwFcByTeam[i].values, branch: t.branch }))}
          totals={abwFcTotal}
          colorDeltas
          filter={filter}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Differenz"
        subtitle="Rechnungen − Ziel"
        summary={fmtDeltaShort(visibleDiff)}
      >
        <DerivedMetricTable
          teams={teams.map((t, i) => ({ name: t.name, values: diffByTeam[i].values, branch: t.branch }))}
          totals={diffTotal}
          colorDeltas
          filter={filter}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Gestellte Rechnungen"
        summary={`Σ ${fmtEUR(visibleRechnungen)}`}
      >
        <MetricTable
          metric="rechnungen"
          teams={teams}
          totals={rechnungenTotal}
          editable
          filter={filter}
          trailing={(t) => <RechnungenTrailing team={t} visibleMonths={filter.months} />}
          trailingTotalLabel="FTE Σ"
          trailingTotal={<RechnungenTotalTrailing teams={teams} total={visibleRechnungen} />}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Forecast"
        summary={`Σ ${fmtEUR(visibleForecast)}`}
      >
        <MetricTable
          metric="forecast"
          teams={teams}
          totals={forecastTotal}
          editable
          filter={filter}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Zielvorgaben"
        subtitle="aus Ziele"
        summary={`Σ ${fmtEUR(visibleZiel)}`}
        defaultOpen={false}
      >
        <ZielvorgabenTable teams={teams} totals={zielTotal} filter={filter} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Teams aus Ziele"
        summary={`${teams.length} Teams · ${fmtDecimal(totalFte, 2)} FTE`}
        defaultOpen={false}
      >
        <TeamsOverview teams={teams} totalFte={totalFte} />
      </CollapsibleSection>
    </div>
  )
}

type QuarterFilter = {
  months: readonly number[]
  quarters: readonly number[]
  showTotal: boolean
}

function quarterFilter(q: QuarterView): QuarterFilter {
  if (q === 'all') {
    return { months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], quarters: [0, 1, 2, 3], showTotal: true }
  }
  const idx = Number(q.slice(1)) - 1
  return { months: [idx * 3, idx * 3 + 1, idx * 3 + 2], quarters: [idx], showTotal: false }
}

function visibleSum(values: MonthValues, months: readonly number[]): number {
  return months.reduce<number>((s, i) => s + (values[i] ?? 0), 0)
}

// Puffer is cumulative — the last non-null month in the visible range is the
// running total users care about ("where do we stand right now").
function lastNonNull(values: MonthValues, months: readonly number[]): number | null {
  for (let i = months.length - 1; i >= 0; i--) {
    const v = values[months[i]]
    if (v !== null && v !== undefined) return v
  }
  return null
}

type SummableMetric = 'forecast' | 'rechnungen' | 'ziel'

function sumMetric(teams: UmsatzTeamView[], metric: SummableMetric): MonthValues {
  let out: MonthValues = Array.from({ length: 12 }, () => null)
  for (const t of teams) out = addMonthValues(out, t[metric])
  return out
}

function branchCumulative(
  diffs: { team: UmsatzTeamView; values: MonthValues }[],
  branch: UmsatzBranch,
): MonthValues {
  let combined: MonthValues = Array.from({ length: 12 }, () => null)
  for (const { team, values } of diffs) {
    if (team.branch !== branch) continue
    combined = addMonthValues(combined, values)
  }
  return cumulativeMonthValues(combined)
}

function fmtDeltaShort(v: number | null): string {
  if (v === null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${fmtEUR(v)}`
}

function CollapsibleSection({
  title,
  subtitle,
  summary,
  action,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  summary?: React.ReactNode
  action?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(!defaultOpen)
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/30"
        >
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
              collapsed && '-rotate-90',
            )}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-none">{title}</div>
            {subtitle && (
              <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
            )}
          </div>
          {summary && (
            <div className="num ml-auto flex items-center gap-1.5 whitespace-nowrap pl-4 text-xs text-muted-foreground">
              {summary}
            </div>
          )}
        </button>
        {action && (
          <div className="flex items-center border-l px-2">{action}</div>
        )}
      </div>
      {!collapsed && <div className={cn('overflow-auto border-t')}>{children}</div>}
    </section>
  )
}

function TeamsOverview({ teams, totalFte }: { teams: UmsatzTeamView[]; totalFte: number }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="bg-muted/20">
        <tr className="border-b text-xs font-medium text-muted-foreground">
          <th className="px-2 py-1.5 text-left">Team</th>
          <th className="w-24 px-2 py-1.5 text-left">NL</th>
          <th className="num w-24 px-2 py-1.5">FTE</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((t) => (
          <tr key={t.id} className="border-b last:border-b-0">
            <td className="px-2 py-1.5 text-sm font-medium">{t.name}</td>
            <td className="px-2 py-1.5 text-xs text-muted-foreground">
              NL {t.branch.toUpperCase()}
            </td>
            <td className="num px-2 py-1.5 text-sm">{fmtDecimal(t.fte, 2)}</td>
          </tr>
        ))}
        <tr className="border-t border-foreground/40 font-semibold">
          <td className="px-2 py-1.5 text-sm">Σ</td>
          <td className="px-2 py-1.5 text-xs text-muted-foreground">{teams.length} Teams</td>
          <td className="num px-2 py-1.5 text-sm">{fmtDecimal(totalFte, 2)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function MetricTable({
  metric,
  teams,
  totals,
  editable,
  filter,
  trailing,
  trailingTotalLabel,
  trailingTotal,
}: {
  metric: MetricKey
  teams: UmsatzTeamView[]
  totals: MonthValues
  editable?: boolean
  filter: QuarterFilter
  trailing?: (team: UmsatzTeamView) => React.ReactNode
  trailingTotalLabel?: string
  trailingTotal?: React.ReactNode
}) {
  const updateCell = useUmsatz((s) => s.updateCell)
  return (
    <table className="w-full border-collapse text-sm">
      <HeaderRow filter={filter} trailing={trailing ? trailingTotalLabel : undefined} />
      <tbody>
        {teams.map((team) => (
          <tr key={team.id} className="border-b last:border-b-0 hover:bg-accent">
            <TeamNameCell name={team.name} />
            <MonthRow
              values={team[metric]}
              filter={filter}
              onChange={editable ? (idx, v) => updateCell(team.id, metric, idx, v) : undefined}
            />
            {trailing && <td className="border-l">{trailing(team)}</td>}
          </tr>
        ))}
        <tr className="border-t border-foreground/40 font-semibold">
          <TeamNameCell name="Σ" />
          <MonthRow values={totals} filter={filter} />
          {trailingTotal && <td className="border-l">{trailingTotal}</td>}
        </tr>
      </tbody>
    </table>
  )
}

function ZielvorgabenTable({
  teams,
  totals,
  filter,
}: {
  teams: UmsatzTeamView[]
  totals: MonthValues
  filter: QuarterFilter
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <HeaderRow filter={filter} />
      <tbody>
        {teams.map((team) => (
          <tr key={team.id} className="border-b last:border-b-0">
            <TeamNameCell name={team.name} />
            <MonthRow values={team.ziel} filter={filter} />
          </tr>
        ))}
        <tr className="border-t border-foreground/40 font-semibold">
          <TeamNameCell name="Σ" />
          <MonthRow values={totals} filter={filter} />
        </tr>
      </tbody>
    </table>
  )
}

function DerivedMetricTable({
  teams,
  totals,
  colorDeltas,
  filter,
}: {
  teams: { name: string; values: MonthValues; branch: UmsatzBranch }[]
  totals: MonthValues
  colorDeltas?: boolean
  filter: QuarterFilter
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <HeaderRow filter={filter} />
      <tbody>
        {teams.map((team, i) => (
          <tr key={i} className="border-b last:border-b-0">
            <TeamNameCell name={team.name} />
            <MonthRow values={team.values} filter={filter} colorDeltas={colorDeltas} />
          </tr>
        ))}
        <tr className="border-t border-foreground/40 font-semibold">
          <TeamNameCell name="Σ" />
          <MonthRow values={totals} filter={filter} colorDeltas={colorDeltas} />
        </tr>
      </tbody>
    </table>
  )
}

function HeaderRow({ filter, trailing }: { filter: QuarterFilter; trailing?: string }) {
  const quarterEnds = new Set(filter.quarters.map((q) => q * 3 + 2))
  return (
    <thead className="bg-muted/20">
      <tr className="border-b">
        <th className="sticky left-0 z-10 min-w-[180px] border-r bg-muted/20 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
          Team
        </th>
        {filter.months.map((idx) => {
          const q = quarterEnds.has(idx) ? Math.floor(idx / 3) : -1
          return (
            <Fragment key={idx}>
              <th className="num min-w-[72px] px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {MONTH_LABELS[idx]}
              </th>
              {q !== -1 && (
                <th className="num min-w-[88px] border-l bg-muted/40 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {QUARTER_LABELS[q]}
                </th>
              )}
            </Fragment>
          )
        })}
        {filter.showTotal && (
          <th className="num min-w-[96px] border-l bg-muted/40 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Σ
          </th>
        )}
        {trailing && (
          <th className="num min-w-[120px] border-l bg-muted/40 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            {trailing}
          </th>
        )}
      </tr>
    </thead>
  )
}

function TeamNameCell({ name }: { name: string }) {
  return (
    <td className="sticky left-0 z-10 min-w-[180px] whitespace-nowrap border-r bg-card px-2 py-1.5 text-sm font-medium">
      {name}
    </td>
  )
}

function MonthRow({
  values,
  filter,
  onChange,
  colorDeltas,
}: {
  values: MonthValues
  filter: QuarterFilter
  onChange?: (monthIndex: number, v: number | null) => void
  colorDeltas?: boolean
}) {
  const quarterEnds = new Set(filter.quarters.map((q) => q * 3 + 2))
  const cells: React.ReactNode[] = []
  for (const i of filter.months) {
    cells.push(
      <td key={`m${i}`} className="px-0">
        {onChange ? (
          <NumCell value={values[i] ?? null} onChange={(v) => onChange(i, v)} />
        ) : (
          <ReadCell v={values[i] ?? null} colorDeltas={colorDeltas} />
        )}
      </td>,
    )
    if (quarterEnds.has(i)) {
      const q = Math.floor(i / 3) as 0 | 1 | 2 | 3
      cells.push(
        <td key={`q${q}`} className="border-l bg-muted/30 px-0">
          <ReadCell v={quarterSum(values, q)} bold colorDeltas={colorDeltas} />
        </td>,
      )
    }
  }
  if (filter.showTotal) {
    cells.push(
      <td key="sum" className="border-l bg-muted/40 px-0">
        <ReadCell v={totalSum(values)} bold colorDeltas={colorDeltas} />
      </td>,
    )
  }
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
    return <div className="num px-2 py-1.5 text-sm text-muted-foreground/30">—</div>
  }
  // Negatives are always surfaced; positives only when they clear the threshold,
  // so we don't light up noise above zero.
  const tone = colorDeltas
    ? v < 0
      ? 'text-destructive'
      : v >= HIGHLIGHT_THRESHOLD_EUR
        ? 'text-emerald-600 dark:text-emerald-400'
        : ''
    : ''
  return (
    <div className={cn('num px-2 py-1.5 text-sm tabular-nums', bold && 'font-semibold', tone)}>
      {fmtEUR(v)}
    </div>
  )
}

function RechnungenTrailing({
  team,
  visibleMonths,
}: {
  team: UmsatzTeamView
  visibleMonths: readonly number[]
}) {
  const summe = visibleSum(team.rechnungen, visibleMonths)
  const annualized = team.fte > 0 ? (summe / visibleMonths.length) * 12 / team.fte : null
  return (
    <div className="flex items-center justify-end gap-3 px-3 py-1.5 font-mono text-xs text-muted-foreground">
      <span>{fmtDecimal(team.fte, 2)} FTE</span>
      <span className="font-semibold text-foreground">
        {annualized !== null ? `${fmtEUR(annualized)} €/FTE p.a.` : '—'}
      </span>
    </div>
  )
}

function RechnungenTotalTrailing({ teams, total }: { teams: UmsatzTeamView[]; total: number }) {
  const fte = teams.reduce((s, t) => s + (t.fte || 0), 0)
  const perFte = fte > 0 ? total / fte : null
  return (
    <div className="flex items-center justify-end gap-3 px-3 py-1.5 font-mono text-xs font-semibold">
      <span>{fmtDecimal(fte, 2)} FTE</span>
      <span>{perFte !== null ? `${fmtEUR(perFte)} €/FTE` : '—'}</span>
    </div>
  )
}
