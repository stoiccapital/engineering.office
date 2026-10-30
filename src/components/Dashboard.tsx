import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useDashboard } from '@/dashboard-store'
import {
  computeSixMetrics,
  groupByProjektleiter,
  listProjectsForPM,
  type PMGroup,
  type SixMetrics,
} from '@/lib/analytics'
import { derive } from '@/types'
import { fmtEUR, fmtPct } from '@/lib/format'
import { KPICard, KPIGrid } from '@/components/ui/kpi-card'
import { LoadingCard } from '@/components/ui/loading-card'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'

const KRIT_HIGH = 0.3

export function Dashboard() {
  const periods = useDashboard((s) => s.periods)
  const year = useDashboard((s) => s.year)
  const quarter = useDashboard((s) => s.quarter)
  const status = useDashboard((s) => s.status)
  const load = useDashboard((s) => s.load)

  useEffect(() => {
    if (status === 'idle') void load()
  }, [status, load])

  const current = periods[quarter] ?? null
  const rows = current?.rows ?? []
  const totals = useMemo(() => computeSixMetrics(rows), [rows])
  const groups = useMemo(() => groupByProjektleiter(current), [current])

  const gesamt = totals.deBereinigtSumme + totals.plSumme
  const totalKritisch = totals.deBereinigtKritisch + totals.plKritisch
  const kritischShare = gesamt > 0 ? totalKritisch / gesamt : null
  const projectCount = rows.filter(hasAnyMoney).length
  const pmCount = groups.filter((g) => g.name !== 'Ohne Zuordnung').length

  if (status === 'loading' || status === 'idle') {
    return <LoadingCard>Lade Analytik…</LoadingCard>
  }

  return (
    <>
      <HeroCard
        year={year}
        quarter={quarter}
        gesamt={gesamt}
        projectCount={projectCount}
        pmCount={pmCount}
        kritischShare={kritischShare}
      />

      <KPIGrid cols={6}>
        <KPICard label="DE bereinigt Summe" value={fmtEUR(totals.deBereinigtSumme)} unit="€" />
        <KPICard
          label="DE bereinigt wahrscheinlich"
          value={fmtEUR(totals.deBereinigtWahrscheinlich)}
          unit="€"
        />
        <KPICard
          label="DE bereinigt kritisch"
          value={fmtEUR(totals.deBereinigtKritisch)}
          unit="€"
          tone="danger"
          sub={shareOf(totals.deBereinigtKritisch, totals.deBereinigtSumme)}
        />
        <KPICard label="Forecast Polen Summe" value={fmtEUR(totals.plSumme)} unit="€" />
        <KPICard
          label="Forecast Polen wahrscheinlich"
          value={fmtEUR(totals.plWahrscheinlich)}
          unit="€"
        />
        <KPICard
          label="Forecast Polen kritisch"
          value={fmtEUR(totals.plKritisch)}
          unit="€"
          tone="danger"
          sub={shareOf(totals.plKritisch, totals.plSumme)}
        />
      </KPIGrid>

      <Section
        title="Projektleiter"
        subtitle={`${groups.length} ${groups.length === 1 ? 'Eintrag' : 'Einträge'} · sortiert nach Gesamt`}
        padded={false}
      >
        <PMTable groups={groups} companyGesamt={gesamt} totals={totals} />
      </Section>
    </>
  )
}

function HeroCard({
  year,
  quarter,
  gesamt,
  projectCount,
  pmCount,
  kritischShare,
}: {
  year: number
  quarter: string
  gesamt: number
  projectCount: number
  pmCount: number
  kritischShare: number | null
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Gesamt (DE + PL) · {year} {quarter}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold tabular-nums md:text-5xl">
              {fmtEUR(gesamt) || '—'}
            </span>
            {gesamt > 0 && <span className="text-xl text-muted-foreground">€</span>}
          </div>
          <div className="mt-2 font-mono text-sm text-muted-foreground tabular-nums">
            {projectCount} {projectCount === 1 ? 'aktives Projekt' : 'aktive Projekte'} ·{' '}
            {pmCount} {pmCount === 1 ? 'Projektleiter' : 'Projektleiter'}
          </div>
        </div>

        {kritischShare !== null && (
          <div className="shrink-0 rounded-md border bg-background px-4 py-3 text-right">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Kritisch-Anteil
            </div>
            <div
              className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                kritischShare > KRIT_HIGH ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {fmtPct(kritischShare)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PMTable({
  groups,
  companyGesamt,
  totals,
}: {
  groups: PMGroup[]
  companyGesamt: number
  totals: SixMetrics
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())

  function toggle(name: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  if (groups.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
        Keine Projektleiter in diesem Quartal.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/40 text-muted-foreground">
            <Th className="text-left">Projektleiter</Th>
            <Th className="num">Projekte</Th>
            <Th className="num border-l">DE Σ</Th>
            <Th className="num">DE wahr.</Th>
            <Th className="num">DE krit.</Th>
            <Th className="num border-l">PL Σ</Th>
            <Th className="num">PL wahr.</Th>
            <Th className="num">PL krit.</Th>
            <Th className="num border-l">Gesamt</Th>
            <Th className="num">% Ges.</Th>
            <Th className="num">% krit.</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <PMRow
              key={g.name}
              g={g}
              companyGesamt={companyGesamt}
              isOpen={open.has(g.name)}
              onToggle={() => toggle(g.name)}
            />
          ))}
        </tbody>
        <tfoot className="border-t">
          <TotalsRow totals={totals} companyGesamt={companyGesamt} />
        </tfoot>
      </table>
    </div>
  )
}

function PMRow({
  g,
  companyGesamt,
  isOpen,
  onToggle,
}: {
  g: PMGroup
  companyGesamt: number
  isOpen: boolean
  onToggle: () => void
}) {
  const m = g.metrics
  const gesamt = m.deBereinigtSumme + m.plSumme
  const kritisch = m.deBereinigtKritisch + m.plKritisch
  const shareGesamt = companyGesamt > 0 ? gesamt / companyGesamt : null
  const shareKritisch = gesamt > 0 ? kritisch / gesamt : null
  const atRisk = shareKritisch !== null && shareKritisch > KRIT_HIGH
  const isUnassigned = g.name === 'Ohne Zuordnung'

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'cursor-pointer border-b last:border-b-0 hover:bg-accent/40',
          atRisk && 'bg-destructive/[0.03]',
          isOpen && 'bg-accent/40',
        )}
      >
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {atRisk && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />}
            <span className={isUnassigned ? 'italic text-muted-foreground' : 'font-medium'}>
              {g.name}
            </span>
          </div>
        </td>
        <NumTd v={g.projectCount} format="int" />
        <NumTd v={m.deBereinigtSumme} className="border-l" />
        <NumTd v={m.deBereinigtWahrscheinlich} dim />
        <NumTd v={m.deBereinigtKritisch} />
        <NumTd v={m.plSumme} className="border-l" />
        <NumTd v={m.plWahrscheinlich} dim />
        <NumTd v={m.plKritisch} />
        <NumTd v={gesamt} className="border-l" bold />
        <NumTd v={shareGesamt} format="pct" dim />
        <NumTd v={shareKritisch} format="pct" tone={atRisk ? 'danger' : undefined} />
      </tr>
      {isOpen && (
        <tr className="border-b bg-muted/20">
          <td colSpan={11} className="p-0">
            <ProjectsSubTable g={g} />
          </td>
        </tr>
      )}
    </>
  )
}

function ProjectsSubTable({ g }: { g: PMGroup }) {
  const projects = useMemo(
    () =>
      listProjectsForPM(g).filter((p) => {
        const d = derive(p.row)
        const deB = d.forecastDEBereinigt ?? 0
        const pl = p.row.forecastPL ?? 0
        if (p.side === 'DE') return deB > 0
        if (p.side === 'PL') return pl > 0
        return deB + pl > 0
      }),
    [g],
  )

  if (projects.length === 0) {
    return (
      <div className="px-6 py-3 text-xs text-muted-foreground">
        Keine Projekte mit Forecast &gt; 0.
      </div>
    )
  }

  return (
    <div className="px-6 py-3">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <SubTh className="w-24 text-left">Proj. Nr.</SubTh>
            <SubTh className="text-left">Projektname</SubTh>
            <SubTh className="w-20 text-left">Seite</SubTh>
            <SubTh className="num w-32">Forecast</SubTh>
            <SubTh className="w-12 text-center">Flag</SubTh>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <ProjectSubRow key={p.row.id} p={p} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProjectSubRow({ p }: { p: import('@/lib/analytics').PMProject }) {
  const d = derive(p.row)
  const deB = d.forecastDEBereinigt ?? 0
  const pl = p.row.forecastPL ?? 0

  let forecastDisplay: React.ReactNode
  if (p.side === 'DE') forecastDisplay = <span>{fmtEUR(deB) || '—'}</span>
  else if (p.side === 'PL') forecastDisplay = <span>{fmtEUR(pl) || '—'}</span>
  else
    forecastDisplay = (
      <span>
        <span className="text-muted-foreground">DE</span> {fmtEUR(deB) || '—'}{' '}
        <span className="ml-2 text-muted-foreground">PL</span> {fmtEUR(pl) || '—'}
      </span>
    )

  const flag =
    p.side === 'DE' ? p.row.flagDE : p.side === 'PL' ? p.row.flagPL : null

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-2 py-1.5 font-mono">{p.row.projNr || '—'}</td>
      <td className="max-w-[480px] truncate px-2 py-1.5">
        {p.row.projektname || <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-2 py-1.5 text-muted-foreground">{p.side}</td>
      <td className="num px-2 py-1.5">{forecastDisplay}</td>
      <td className="px-2 py-1.5 text-center">
        {flag ? (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold',
              flag === 'k' ? 'bg-destructive/10 text-destructive' : 'bg-muted',
            )}
          >
            {flag}
          </span>
        ) : (
          <span className="text-muted-foreground/40">·</span>
        )}
      </td>
    </tr>
  )
}

function SubTh({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={`px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider ${
        className ?? ''
      }`}
    >
      {children}
    </th>
  )
}

function TotalsRow({
  totals,
  companyGesamt,
}: {
  totals: SixMetrics
  companyGesamt: number
}) {
  const kritisch = totals.deBereinigtKritisch + totals.plKritisch
  const shareKritisch = companyGesamt > 0 ? kritisch / companyGesamt : null
  return (
    <tr className="bg-muted/60 font-semibold">
      <td className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
        Summe
      </td>
      <td />
      <NumTd v={totals.deBereinigtSumme} className="border-l" />
      <NumTd v={totals.deBereinigtWahrscheinlich} dim />
      <NumTd v={totals.deBereinigtKritisch} />
      <NumTd v={totals.plSumme} className="border-l" />
      <NumTd v={totals.plWahrscheinlich} dim />
      <NumTd v={totals.plKritisch} />
      <NumTd v={companyGesamt} className="border-l" bold />
      <NumTd v={1} format="pct" dim />
      <NumTd
        v={shareKritisch}
        format="pct"
        tone={shareKritisch !== null && shareKritisch > KRIT_HIGH ? 'danger' : undefined}
      />
    </tr>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider ${
        className ?? ''
      }`}
    >
      {children}
    </th>
  )
}

function NumTd({
  v,
  format = 'eur',
  dim,
  bold,
  tone,
  className,
}: {
  v: number | null
  format?: 'eur' | 'pct' | 'int'
  dim?: boolean
  bold?: boolean
  tone?: 'danger'
  className?: string
}) {
  const str =
    v === null
      ? ''
      : format === 'pct'
        ? fmtPct(v)
        : format === 'int'
          ? String(v)
          : fmtEUR(v)
  const display = str || <span className="text-muted-foreground/40">—</span>
  return (
    <td
      className={`num px-3 py-2 ${bold ? 'font-semibold' : ''} ${
        dim ? 'text-muted-foreground' : ''
      } ${tone === 'danger' ? 'text-destructive' : ''} ${className ?? ''}`}
    >
      {display}
    </td>
  )
}

function hasAnyMoney(r: {
  forecastDE: number | null
  forecastPL: number | null
  abgerechnetDE: number | null
  abgerechnetPL: number | null
}): boolean {
  return (
    (r.forecastDE ?? 0) !== 0 ||
    (r.forecastPL ?? 0) !== 0 ||
    (r.abgerechnetDE ?? 0) !== 0 ||
    (r.abgerechnetPL ?? 0) !== 0
  )
}

function shareOf(part: number, whole: number): string | undefined {
  if (whole <= 0) return undefined
  return fmtPct(part / whole) + ' Anteil'
}
