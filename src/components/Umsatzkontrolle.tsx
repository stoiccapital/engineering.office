import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Section } from '@/components/ui/section'
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

export function Umsatzkontrolle() {
  const data = useUmsatz((s) => s.data)
  const quarter = useUmsatz((s) => s.quarter)
  const umsatzYear = useUmsatz((s) => s.year)

  const ziele = useZiele((s) => s.ziele)
  const zieleYear = useZiele((s) => s.year)
  const setZieleYear = useZiele((s) => s.setYear)
  const loadZiele = useZiele((s) => s.load)

  // Zielkontrolle year drives Ziele year — teams and targets must come from the same year.
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

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Teams, FTE und Zielvorgaben werden in <strong className="font-medium text-foreground">Ziele</strong> verwaltet.
        Hier werden nur <strong className="font-medium text-foreground">Forecast</strong> und
        <strong className="font-medium text-foreground"> Rechnungen</strong> gepflegt.
      </div>

      <Section
        title="Zielkontrolle"
        subtitle={`${teams.length} Teams · ${fmtDecimal(totalFte, 2)} FTE gesamt`}
        padded={false}
      >
        <div className="space-y-6 p-4">
          {teams.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
              Keine Teams in Ziele für {umsatzYear}. Lege Teams in Ziele an, um Daten hier zu pflegen.
            </div>
          ) : (
            <>
              <TeamsOverview teams={teams} />
              <MetricTable
                title="Forecast"
                metric="forecast"
                teams={teams}
                totals={forecastTotal}
                editable
                filter={filter}
              />
              <MetricTable
                title="Gestellte Rechnungen"
                metric="rechnungen"
                teams={teams}
                totals={rechnungenTotal}
                editable
                filter={filter}
                trailing={(t) => <RechnungenTrailing team={t} visibleMonths={filter.months} />}
                trailingTotalLabel="FTE Σ"
                trailingTotal={
                  <RechnungenTotalTrailing
                    teams={teams}
                    total={visibleSum(rechnungenTotal, filter.months)}
                  />
                }
              />
              <ZielvorgabenTable teams={teams} totals={zielTotal} filter={filter} />
              <DerivedMetricTable
                title="Differenz (Rg. − Ziel)"
                teams={teams.map((t, i) => ({ name: t.name, values: diffByTeam[i].values, branch: t.branch }))}
                totals={diffTotal}
                colorDeltas
                filter={filter}
              />
              <div className="mt-4 border-t pt-6">
                <PufferRows deValues={pufferDE} plValues={pufferPL} filter={filter} />
              </div>
            </>
          )}
        </div>
      </Section>

      {teams.length > 0 && (
        <Section
          title="Forecast Kontrolle"
          padded={false}
          action={
            <InfoTooltip>
              <div className="space-y-2">
                <div className="font-medium">Farbkodierung</div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-muted-foreground">Forecast überschritten (&gt; 20 k)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                  <span className="text-muted-foreground">Forecast unterschritten (&lt; −20 k)</span>
                </div>
              </div>
            </InfoTooltip>
          }
        >
          <div className="p-4">
            <DerivedMetricTable
              title="Abweichung Forecast (Rg. − Forecast)"
              teams={teams.map((t, i) => ({ name: t.name, values: abwFcByTeam[i].values, branch: t.branch }))}
              totals={abwFcTotal}
              colorDeltas
              filter={filter}
            />
          </div>
        </Section>
      )}
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

function CollapsibleBlock({
  title,
  badge,
  summary,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode
  badge?: React.ReactNode
  summary?: React.ReactNode
  defaultOpen?: boolean
  // Receives collapsed so the body can hide per-team rows but still render totals.
  children: (collapsed: boolean) => React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(!defaultOpen)
  return (
    <div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-1 rounded px-1 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        <span>{title}</span>
        {badge && <span className="ml-1">{badge}</span>}
        {summary && (
          <span className="ml-auto font-mono tabular-nums text-muted-foreground">
            {summary}
          </span>
        )}
      </button>
      <div className="overflow-auto">{children(collapsed)}</div>
    </div>
  )
}

function TeamsOverview({ teams }: { teams: UmsatzTeamView[] }) {
  const totalFte = teams.reduce((s, t) => s + (t.fte || 0), 0)
  return (
    <CollapsibleBlock
      title="Teams aus Ziele"
      summary={
        <>
          {teams.length} Teams · {fmtDecimal(totalFte, 2)} FTE
        </>
      }
    >
      {(collapsed) => (
        <table className="w-full border-collapse text-sm">
          {!collapsed && (
            <thead>
              <tr className="border-b bg-muted/20 text-xs font-medium text-muted-foreground">
                <th className="px-2 py-1.5 text-left">Team</th>
                <th className="w-24 px-2 py-1.5 text-left">NL</th>
                <th className="num w-24 px-2 py-1.5 text-right">FTE</th>
              </tr>
            </thead>
          )}
          <tbody>
            {!collapsed &&
              teams.map((t) => (
                <tr key={t.id} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5 text-sm font-medium">{t.name}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">
                    NL {t.branch.toUpperCase()}
                  </td>
                  <td className="num px-2 py-1.5 text-right font-mono text-sm tabular-nums">
                    {fmtDecimal(t.fte, 2)}
                  </td>
                </tr>
              ))}
            <tr className={cn('font-semibold', !collapsed && 'border-t-2 border-foreground/20')}>
              <td className="px-2 py-1.5 text-sm">Σ Gesamt</td>
              <td className="px-2 py-1.5 text-xs text-muted-foreground">
                {teams.length} Teams
              </td>
              <td className="num px-2 py-1.5 text-right font-mono text-sm tabular-nums">
                {fmtDecimal(totalFte, 2)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </CollapsibleBlock>
  )
}

function MetricTable({
  title,
  metric,
  teams,
  totals,
  editable,
  filter,
  trailing,
  trailingTotalLabel,
  trailingTotal,
}: {
  title: string
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
    <CollapsibleBlock title={title}>
      {(collapsed) => (
        <table className="w-full border-collapse text-sm">
          {!collapsed && (
            <HeaderRow filter={filter} trailing={trailing ? trailingTotalLabel : undefined} />
          )}
          <tbody>
            {!collapsed &&
              teams.map((team) => (
                <tr key={team.id} className="border-b last:border-b-0 hover:bg-accent">
                  <TeamNameCell name={team.name} />
                  <MonthRow
                    values={team[metric]}
                    filter={filter}
                    onChange={
                      editable
                        ? (idx, v) => updateCell(team.id, metric, idx, v)
                        : undefined
                    }
                  />
                  {trailing && <td className="border-l">{trailing(team)}</td>}
                </tr>
              ))}
            <tr className={cn('font-semibold', !collapsed && 'border-t-2 border-foreground/20')}>
              <TeamNameCell name={`Gesamt ${title}`} />
              <MonthRow values={totals} filter={filter} />
              {trailingTotal && <td className="border-l">{trailingTotal}</td>}
            </tr>
          </tbody>
        </table>
      )}
    </CollapsibleBlock>
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
    <CollapsibleBlock
      title="Zielvorgaben"
      badge={
        <span className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
          aus Ziele
        </span>
      }
    >
      {(collapsed) => (
        <table className="w-full border-collapse text-sm">
          {!collapsed && <HeaderRow filter={filter} />}
          <tbody>
            {!collapsed &&
              teams.map((team) => (
                <tr key={team.id} className="border-b last:border-b-0">
                  <TeamNameCell name={team.name} />
                  <MonthRow values={team.ziel} filter={filter} />
                </tr>
              ))}
            <tr className={cn('font-semibold', !collapsed && 'border-t-2 border-foreground/20')}>
              <TeamNameCell name="Gesamt Zielvorgaben" />
              <MonthRow values={totals} filter={filter} />
            </tr>
          </tbody>
        </table>
      )}
    </CollapsibleBlock>
  )
}

function DerivedMetricTable({
  title,
  teams,
  totals,
  colorDeltas,
  filter,
}: {
  title: string
  teams: { name: string; values: MonthValues; branch: UmsatzBranch }[]
  totals: MonthValues
  colorDeltas?: boolean
  filter: QuarterFilter
}) {
  return (
    <CollapsibleBlock title={title}>
      {(collapsed) => (
        <table className="w-full border-collapse text-sm">
          {!collapsed && <HeaderRow filter={filter} />}
          <tbody>
            {!collapsed &&
              teams.map((team, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <TeamNameCell name={`Δ${team.name}`} />
                  <MonthRow values={team.values} filter={filter} colorDeltas={colorDeltas} />
                </tr>
              ))}
            <tr className={cn('font-semibold', !collapsed && 'border-t-2 border-foreground/20')}>
              <TeamNameCell name="Σ Differenz" />
              <MonthRow values={totals} filter={filter} colorDeltas={colorDeltas} />
            </tr>
          </tbody>
        </table>
      )}
    </CollapsibleBlock>
  )
}

function PufferRows({
  deValues,
  plValues,
  filter,
}: {
  deValues: MonthValues
  plValues: MonthValues
  filter: QuarterFilter
}) {
  return (
    <CollapsibleBlock title="Verbleibender Puffer (kumuliert)">
      {(collapsed) => (
        <table className="w-full border-collapse text-sm">
          {!collapsed && <HeaderRow filter={filter} />}
          <tbody>
            <tr className={cn('hover:bg-accent', !collapsed && 'border-b')}>
              <TeamNameCell name="Puffer NL DE" />
              <MonthRow values={deValues} filter={filter} colorDeltas />
            </tr>
            <tr className="hover:bg-accent">
              <TeamNameCell name="Puffer NL PL" />
              <MonthRow values={plValues} filter={filter} colorDeltas />
            </tr>
          </tbody>
        </table>
      )}
    </CollapsibleBlock>
  )
}

function HeaderRow({ filter, trailing }: { filter: QuarterFilter; trailing?: string }) {
  const quarterEnds = new Set(filter.quarters.map((q) => q * 3 + 2))
  return (
    <thead className="bg-muted/20">
      <tr className="border-b">
        <th className="sticky left-0 z-10 min-w-[180px] bg-muted/20 px-2 py-2 text-left text-xs font-medium text-muted-foreground">
          Team
        </th>
        {filter.months.map((idx) => {
          const q = quarterEnds.has(idx) ? Math.floor(idx / 3) : -1
          return (
            <Fragment key={idx}>
              <th className="num min-w-[72px] px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                {MONTH_LABELS[idx]}
              </th>
              {q !== -1 && (
                <th className="num min-w-[88px] border-l bg-muted/40 px-2 py-2 text-right text-xs font-semibold text-muted-foreground">
                  {QUARTER_LABELS[q]}
                </th>
              )}
            </Fragment>
          )
        })}
        {filter.showTotal && (
          <th className="num min-w-[96px] border-l bg-muted/40 px-2 py-2 text-right text-xs font-semibold text-muted-foreground">
            Σ
          </th>
        )}
        {trailing && (
          <th className="num min-w-[120px] border-l bg-muted/40 px-2 py-2 text-right text-xs font-semibold text-muted-foreground">
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
    return (
      <div className="num px-2 py-1.5 text-right text-sm text-muted-foreground/30">—</div>
    )
  }
  const tone =
    colorDeltas && Math.abs(v) >= 20_000
      ? v > 0
        ? 'text-emerald-600'
        : 'text-red-600'
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
