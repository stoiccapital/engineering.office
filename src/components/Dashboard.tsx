import { useEffect, useMemo } from 'react'
import { useDashboard } from '@/dashboard-store'
import {
  computeKPI,
  computePLLoad,
  computeRiskByQuarter,
  computeTopOpen,
  computeYearCompare,
} from '@/lib/analytics'
import { fmtEUR, fmtCompact, fmtPct } from '@/lib/format'
import { derive, type Quarter } from '@/types'
import { cn } from '@/lib/utils'
import { Section } from '@/components/ui/section'
import { KPICard, KPIGrid } from '@/components/ui/kpi-card'
import { LoadingCard } from '@/components/ui/loading-card'

export function Dashboard() {
  const periods = useDashboard((s) => s.periods)
  const quarter = useDashboard((s) => s.quarter)
  const status = useDashboard((s) => s.status)
  const load = useDashboard((s) => s.load)

  useEffect(() => {
    if (status === 'idle') void load()
  }, [status, load])

  const current = periods[quarter] ?? null
  const kpi = useMemo(() => computeKPI(current), [current])
  const yearCompare = useMemo(() => computeYearCompare(periods), [periods])
  const plLoad = useMemo(() => computePLLoad(current, 10), [current])
  const riskByQ = useMemo(() => computeRiskByQuarter(periods), [periods])
  const topOpen = useMemo(() => computeTopOpen(current, 10), [current])

  if (status === 'loading' || status === 'idle') {
    return <LoadingCard>Lade Analytik…</LoadingCard>
  }

  return (
    <>
      <KPIGrid>
        <KPICard
          label="Forecast DE bereinigt"
          value={fmtEUR(kpi.forecastDE)}
          unit="€"
          sub={`${kpi.aktiveProjekte} aktive Projekte`}
        />
        <KPICard
          label="Abgerechnet DE"
          value={fmtEUR(kpi.abgerechnetDE)}
          unit="€"
          sub={kpi.rechnungsquote !== null ? `${fmtPct(kpi.rechnungsquote)} Rechnungsquote` : undefined}
        />
        <KPICard label="Noch offen DE" value={fmtEUR(kpi.nochOffenDE)} unit="€" />
        <KPICard
          label="Risikoanteil"
          value={kpi.risikoanteil !== null ? fmtPct(kpi.risikoanteil) : ''}
          tone={kpi.risikoanteil !== null && kpi.risikoanteil > 0.3 ? 'danger' : undefined}
        />
      </KPIGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Jahresverlauf" subtitle="Forecast vs. Abgerechnet (DE bereinigt)">
          <YearCompareChart data={yearCompare} activeQuarter={quarter} />
        </Section>
        <Section title="Risiko-Mix" subtitle="Forecast nach Flag, pro Quartal">
          <RiskByQuarterChart data={riskByQ} activeQuarter={quarter} />
        </Section>
      </div>

      <Section
        title="Projektleiter Auslastung"
        subtitle={`Top 10 nach Forecast DE bereinigt · ${quarter}`}
      >
        <PLLoadChart data={plLoad} />
      </Section>

      <Section
        title="Top 10 Noch offen DE"
        subtitle={`${quarter} · unverrechnete Leistung`}
        padded={false}
      >
        <TopOpenTable rows={topOpen} />
      </Section>
    </>
  )
}

// ---------- Year compare chart ----------

function YearCompareChart({
  data,
  activeQuarter,
}: {
  data: ReturnType<typeof computeYearCompare>
  activeQuarter: Quarter
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.forecast, d.abgerechnet)))
  const H = 180
  const barGroupW = 70
  const barW = 22
  const gap = 10
  const padL = 24
  const padR = 8
  const padT = 10
  const padB = 24
  const W = padL + padR + data.length * barGroupW

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full">
        <line
          x1={padL}
          y1={H - padB}
          x2={W - padR}
          y2={H - padB}
          className="stroke-border"
        />
        {data.map((d, i) => {
          const xBase = padL + i * barGroupW + (barGroupW - (barW * 2 + gap)) / 2
          const chartH = H - padT - padB
          const fh = (d.forecast / max) * chartH
          const ah = (d.abgerechnet / max) * chartH
          const isActive = d.quarter === activeQuarter
          return (
            <g key={d.quarter}>
              <rect
                x={xBase}
                y={H - padB - fh}
                width={barW}
                height={fh}
                className={cn('fill-foreground/80', !isActive && 'fill-foreground/40')}
              />
              <rect
                x={xBase + barW + gap}
                y={H - padB - ah}
                width={barW}
                height={ah}
                className={cn('fill-emerald-500', !isActive && 'fill-emerald-500/50')}
              />
              <text
                x={xBase + barW + gap / 2}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] font-mono"
              >
                {d.quarter}
              </text>
              <text
                x={xBase + barW / 2}
                y={H - padB - fh - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px] font-mono"
              >
                {fmtCompact(d.forecast)}
              </text>
              <text
                x={xBase + barW + gap + barW / 2}
                y={H - padB - ah - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px] font-mono"
              >
                {fmtCompact(d.abgerechnet)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <LegendDot className="bg-foreground/80" label="Forecast" />
        <LegendDot className="bg-emerald-500" label="Abgerechnet" />
      </div>
    </div>
  )
}

// ---------- Risk by quarter chart ----------

function RiskByQuarterChart({
  data,
  activeQuarter,
}: {
  data: ReturnType<typeof computeRiskByQuarter>
  activeQuarter: Quarter
}) {
  const totals = data.map((d) => d.kritisch + d.wahrscheinlich)
  const max = Math.max(1, ...totals)
  const H = 180
  const barGroupW = 70
  const barW = 32
  const padL = 24
  const padR = 8
  const padT = 10
  const padB = 24
  const W = padL + padR + data.length * barGroupW

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full">
        <line
          x1={padL}
          y1={H - padB}
          x2={W - padR}
          y2={H - padB}
          className="stroke-border"
        />
        {data.map((d, i) => {
          const chartH = H - padT - padB
          const total = d.kritisch + d.wahrscheinlich
          const totalH = (total / max) * chartH
          const kH = total > 0 ? totalH * (d.kritisch / total) : 0
          const wH = totalH - kH
          const x = padL + i * barGroupW + (barGroupW - barW) / 2
          const yBase = H - padB
          const isActive = d.quarter === activeQuarter
          return (
            <g key={d.quarter}>
              <rect
                x={x}
                y={yBase - wH}
                width={barW}
                height={wH}
                className={cn('fill-muted-foreground/40', isActive && 'fill-muted-foreground/70')}
              />
              <rect
                x={x}
                y={yBase - wH - kH}
                width={barW}
                height={kH}
                className={cn('fill-destructive/60', isActive && 'fill-destructive')}
              />
              <text
                x={x + barW / 2}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] font-mono"
              >
                {d.quarter}
              </text>
              <text
                x={x + barW / 2}
                y={yBase - wH - kH - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px] font-mono"
              >
                {fmtCompact(total)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <LegendDot className="bg-destructive" label="kritisch" />
        <LegendDot className="bg-muted-foreground/50" label="wahrscheinlich" />
      </div>
    </div>
  )
}

// ---------- PL load bars ----------

function PLLoadChart({ data }: { data: ReturnType<typeof computePLLoad> }) {
  if (data.length === 0) {
    return <div className="py-6 text-center text-xs text-muted-foreground">Keine Zuordnung</div>
  }
  const max = Math.max(1, ...data.map((d) => d.forecast))

  return (
    <div className="space-y-1">
      {data.map((d) => {
        const pct = (d.forecast / max) * 100
        return (
          <div key={d.name} className="flex items-center gap-3">
            <div className="w-20 shrink-0 text-xs font-mono text-muted-foreground">{d.name}</div>
            <div className="relative h-6 flex-1 rounded bg-muted/40">
              <div
                className="h-full rounded bg-foreground/80"
                style={{ width: `${pct}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-end pr-2">
                <span className="num text-[11px] text-foreground">
                  {fmtEUR(d.forecast)} €
                </span>
              </div>
            </div>
            <div className="num w-10 shrink-0 text-right text-xs text-muted-foreground">
              {d.count}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Top open table ----------

function TopOpenTable({ rows }: { rows: ReturnType<typeof computeTopOpen> }) {
  if (rows.length === 0) {
    return <div className="px-4 py-6 text-center text-xs text-muted-foreground">Nichts offen</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/40 text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Proj. Nr.</th>
            <th className="px-3 py-2 text-left font-medium">Projektname</th>
            <th className="px-3 py-2 text-left font-medium">PL</th>
            <th className="px-3 py-2 text-right font-medium">Forecast DE</th>
            <th className="px-3 py-2 text-right font-medium">Abgerechnet DE</th>
            <th className="px-3 py-2 text-right font-medium">Noch offen DE</th>
            <th className="px-3 py-2 text-center font-medium">Flag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = derive(r)
            return (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="num px-3 py-2">{r.projNr}</td>
                <td className="max-w-[320px] truncate px-3 py-2">{r.projektname}</td>
                <td className="px-3 py-2">{r.projektleiterDE || '—'}</td>
                <td className="num px-3 py-2">{fmtEUR(d.forecastDEBereinigt)}</td>
                <td className="num px-3 py-2">{fmtEUR(d.abgerechnetDEBereinigt)}</td>
                <td className="num px-3 py-2 font-semibold">{fmtEUR(d.nochOffenDE)}</td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                      r.flagDE === 'k' ? 'bg-destructive/10 text-destructive' : 'bg-muted',
                    )}
                  >
                    {r.flagDE}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('inline-block h-2.5 w-2.5 rounded-sm', className)} />
      {label}
    </span>
  )
}
