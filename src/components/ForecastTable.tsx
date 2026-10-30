import { useMemo, useState } from 'react'
import { Trash2, Plus, Lock, Unlock } from 'lucide-react'
import { useForecast } from '@/store'
import { derive } from '@/types'
import type { ProjectRow } from '@/types'
import { NumCell } from './NumCell'
import { TextCell } from './TextCell'
import { FlagToggle } from './FlagToggle'
import { fmtEUR } from '@/lib/format'
import { Section } from '@/components/ui/section'

type ColGroup = { label: string; span: number; leading?: boolean }

const groups: ColGroup[] = [
  { label: 'Projekt', span: 5 },
  { label: 'Forecast', span: 5, leading: true },
  { label: 'Abgerechnet', span: 4, leading: true },
  { label: 'Leistungsstand', span: 4, leading: true },
  { label: '', span: 1 },
]

export function ForecastTable() {
  const period = useForecast((s) => s.period)
  const addRow = useForecast((s) => s.addRow)
  const updateRow = useForecast((s) => s.updateRow)
  const deleteRow = useForecast((s) => s.deleteRow)
  const setFlag = useForecast((s) => s.setFlag)
  const [locked, setLocked] = useState(true)
  const [pmFilter, setPmFilter] = useState<string>('all')

  const rows = period?.rows ?? []
  const pms = useMemo(() => uniquePMs(rows), [rows])

  const filteredRows = useMemo(() => {
    if (pmFilter === 'all') return rows
    if (pmFilter === '__unassigned__') {
      return rows.filter(
        (r) => !(r.projektleiterDE ?? '').trim() && !(r.projektleiterPL ?? '').trim(),
      )
    }
    const canon = pmFilter.toLowerCase()
    return rows.filter(
      (r) =>
        (r.projektleiterDE ?? '').trim().toLowerCase() === canon ||
        (r.projektleiterPL ?? '').trim().toLowerCase() === canon,
    )
  }, [rows, pmFilter])

  const totals = useMemo(() => computeTotals(filteredRows), [filteredRows])

  const subtitle = period
    ? pmFilter === 'all'
      ? `${rows.length} Zeilen · ${period.year} ${period.quarter}`
      : `${filteredRows.length} von ${rows.length} Zeilen · ${period.year} ${period.quarter}`
    : undefined

  return (
    <Section
      title="Projekte"
      subtitle={subtitle}
      padded={false}
      action={
        <div className="flex items-center gap-2">
          <PMFilter value={pmFilter} onChange={setPmFilter} pms={pms} />
          <LockToggle locked={locked} onToggle={() => setLocked((v) => !v)} />
        </div>
      }
      footer={<ForecastLegend />}
    >
      <div className="w-full max-h-[calc(100vh-320px)] overflow-auto">
        <table className="w-full min-w-[1800px] border-collapse text-sm">
          <colgroup>
            <col className="w-14" /> {/* PL DE */}
            <col className="w-14" /> {/* PL PL */}
            <col className="min-w-[360px]" /> {/* Projektname */}
            <col className="w-24" /> {/* Nr */}
            <col className="min-w-[280px]" /> {/* Leistung */}
            <col className="w-28" /> {/* Forecast DE */}
            <col className="w-10" />
            <col className="w-28" /> {/* Forecast PL */}
            <col className="w-10" />
            <col className="w-28" /> {/* Forecast DE bereinigt */}
            <col className="w-28" /> {/* Abg DE */}
            <col className="w-28" /> {/* Abg PL */}
            <col className="w-28" /> {/* Abg bereinigt */}
            <col className="w-28" /> {/* Noch offen */}
            <col className="w-24" /> {/* % DE */}
            <col className="w-28" /> {/* Gew DE */}
            <col className="w-24" /> {/* % PL */}
            <col className="w-28" /> {/* Gew PL */}
            <col className="w-10" />
          </colgroup>

          <thead className="sticky top-0 z-20 bg-card shadow-[inset_0_-1px_0_hsl(var(--border))]">
            <tr>
              {groups.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.span}
                  className={`px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground ${g.leading ? 'border-l' : ''}`}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr className="border-b bg-muted">
              <Th>PL DE</Th>
              <Th>PL PLN</Th>
              <Th>Projektname</Th>
              <Th>Proj. Nr.</Th>
              <Th>Leistung in Worten</Th>
              <Th className="num border-l">Forecast DE</Th>
              <Th>k/w</Th>
              <Th className="num">Forecast PL</Th>
              <Th>k/w</Th>
              <Th className="num text-muted-foreground">DE bereinigt</Th>
              <Th className="num border-l">Abgerechnet DE</Th>
              <Th className="num">Abgerechnet PL</Th>
              <Th className="num text-muted-foreground">Abg. bereinigt</Th>
              <Th className="num text-muted-foreground">Noch offen DE</Th>
              <Th className="num border-l">% DE</Th>
              <Th className="num text-muted-foreground">Gewichtet DE</Th>
              <Th className="num">% PL</Th>
              <Th className="num text-muted-foreground">Gewichtet PL</Th>
              <Th></Th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={19}
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                >
                  Keine Projekte für diese Auswahl.
                </td>
              </tr>
            )}
            {filteredRows.map((row) => (
              <Row
                key={row.id}
                row={row}
                locked={locked}
                onUpdate={(patch) => updateRow(row.id, patch)}
                onFlag={(which, flag) => setFlag(row.id, which, flag)}
                onDelete={() => deleteRow(row.id)}
              />
            ))}
            {!locked && pmFilter === 'all' && (
              <tr>
                <td colSpan={19} className="p-0">
                  <button
                    onClick={addRow}
                    className="flex w-full items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Projekt hinzufügen
                  </button>
                </td>
              </tr>
            )}
          </tbody>

          <tfoot className="border-t">
            <TotalsRow label="Summe" totals={totals.sum} highlight />
            <TotalsRow label="k — kritisch" totals={totals.k} />
            <TotalsRow label="w — wahrscheinlich" totals={totals.w} />
          </tfoot>
        </table>
      </div>
    </Section>
  )
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-2 py-2 text-left text-xs font-medium text-muted-foreground ${className ?? ''}`}
    >
      {children}
    </th>
  )
}

function Row({
  row,
  locked,
  onUpdate,
  onFlag,
  onDelete,
}: {
  row: ProjectRow
  locked: boolean
  onUpdate: (patch: Partial<ProjectRow>) => void
  onFlag: (which: 'flagDE' | 'flagPL', flag: ProjectRow['flagDE']) => void
  onDelete: () => void
}) {
  const d = derive(row)
  const ro = locked
  return (
    <tr className="border-b last:border-b-0 hover:bg-accent/40">
      <Td>
        <TextCell value={row.projektleiterDE} onChange={(v) => onUpdate({ projektleiterDE: v })} placeholder="…" readOnly={ro} />
      </Td>
      <Td>
        <TextCell value={row.projektleiterPL} onChange={(v) => onUpdate({ projektleiterPL: v })} placeholder="…" readOnly={ro} />
      </Td>
      <Td>
        <TextCell
          value={row.projektname}
          onChange={(v) => onUpdate({ projektname: v })}
          placeholder="Projektname"
          readOnly={ro}
          multiline
        />
      </Td>
      <Td>
        <TextCell value={row.projNr} onChange={(v) => onUpdate({ projNr: v })} placeholder="26D000" className="font-mono text-xs" readOnly={ro} />
      </Td>
      <Td>
        <TextCell
          value={row.leistung}
          onChange={(v) => onUpdate({ leistung: v })}
          placeholder="Leistung in Worten"
          readOnly={ro}
          multiline
        />
      </Td>

      <Td className="border-l">
        <NumCell value={row.forecastDE} onChange={(v) => onUpdate({ forecastDE: v })} readOnly={ro} />
      </Td>
      <Td>
        <div className="flex justify-center">
          <FlagToggle value={row.flagDE} onChange={(f) => onFlag('flagDE', f)} compact readOnly={ro} />
        </div>
      </Td>
      <Td>
        <NumCell value={row.forecastPL} onChange={(v) => onUpdate({ forecastPL: v })} readOnly={ro} />
      </Td>
      <Td>
        <div className="flex justify-center">
          <FlagToggle value={row.flagPL} onChange={(f) => onFlag('flagPL', f)} compact readOnly={ro} />
        </div>
      </Td>
      <Td>
        <NumCell value={d.forecastDEBereinigt} readOnly />
      </Td>

      <Td className="border-l">
        <NumCell value={row.abgerechnetDE} onChange={(v) => onUpdate({ abgerechnetDE: v })} readOnly={ro} />
      </Td>
      <Td>
        <NumCell value={row.abgerechnetPL} onChange={(v) => onUpdate({ abgerechnetPL: v })} readOnly={ro} />
      </Td>
      <Td>
        <NumCell value={d.abgerechnetDEBereinigt} readOnly />
      </Td>
      <Td>
        <NumCell value={d.nochOffenDE} readOnly />
      </Td>

      <Td className="border-l">
        <NumCell value={row.leistungsstandDE} onChange={(v) => onUpdate({ leistungsstandDE: v })} pct readOnly={ro} />
      </Td>
      <Td>
        <NumCell value={d.gewichtetDE} readOnly />
      </Td>
      <Td>
        <NumCell value={row.leistungsstandPL} onChange={(v) => onUpdate({ leistungsstandPL: v })} pct readOnly={ro} />
      </Td>
      <Td>
        <NumCell value={d.gewichtetPL} readOnly />
      </Td>
      <Td>
        {!locked && (
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground/40 hover:bg-accent hover:text-destructive"
            title="Zeile löschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </Td>
    </tr>
  )
}

function PMFilter({
  value,
  onChange,
  pms,
}: {
  value: string
  onChange: (v: string) => void
  pms: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus:ring-1 focus:ring-ring"
      title="Nach Projektleiter filtern"
    >
      <option value="all">Alle Projektleiter</option>
      {pms.map((pm) => (
        <option key={pm} value={pm}>
          {pm}
        </option>
      ))}
      <option value="__unassigned__">Ohne Zuordnung</option>
    </select>
  )
}

function uniquePMs(rows: ProjectRow[]): string[] {
  // canon → raw → count. Display the most-common raw form per canon.
  const counts = new Map<string, Map<string, number>>()
  for (const r of rows) {
    for (const raw of [r.projektleiterDE, r.projektleiterPL]) {
      const name = (raw ?? '').trim()
      if (!name) continue
      const canon = name.toLowerCase()
      const inner = counts.get(canon) ?? new Map<string, number>()
      inner.set(name, (inner.get(name) ?? 0) + 1)
      counts.set(canon, inner)
    }
  }
  const out: string[] = []
  for (const inner of counts.values()) {
    let best = ''
    let bestN = -1
    for (const [raw, n] of inner) {
      if (n > bestN) {
        best = raw
        bestN = n
      }
    }
    out.push(best)
  }
  out.sort((a, b) => a.localeCompare(b, 'de'))
  return out
}

function LockToggle({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        locked
          ? 'border-border bg-muted/40 text-muted-foreground hover:bg-accent'
          : 'border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10'
      }`}
      title={locked ? 'Zum Bearbeiten entsperren' : 'Zum Schutz sperren'}
    >
      {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
      {locked ? 'Gesperrt' : 'Entsperrt'}
    </button>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`align-top ${className ?? ''}`}>{children}</td>
}

type Totals = {
  forecastDE: number
  forecastPL: number
  forecastDEBereinigt: number
  abgerechnetDE: number
  abgerechnetPL: number
  abgerechnetDEBereinigt: number
  nochOffenDE: number
  gewichtetDE: number
  gewichtetPL: number
}

function emptyTotals(): Totals {
  return {
    forecastDE: 0,
    forecastPL: 0,
    forecastDEBereinigt: 0,
    abgerechnetDE: 0,
    abgerechnetPL: 0,
    abgerechnetDEBereinigt: 0,
    nochOffenDE: 0,
    gewichtetDE: 0,
    gewichtetPL: 0,
  }
}

function addTo(t: Totals, r: ProjectRow) {
  const d = derive(r)
  t.forecastDE += r.forecastDE ?? 0
  t.forecastPL += r.forecastPL ?? 0
  t.forecastDEBereinigt += d.forecastDEBereinigt ?? 0
  t.abgerechnetDE += r.abgerechnetDE ?? 0
  t.abgerechnetPL += r.abgerechnetPL ?? 0
  t.abgerechnetDEBereinigt += d.abgerechnetDEBereinigt ?? 0
  t.nochOffenDE += d.nochOffenDE ?? 0
  t.gewichtetDE += d.gewichtetDE ?? 0
  t.gewichtetPL += d.gewichtetPL ?? 0
}

function computeTotals(rows: ProjectRow[]) {
  const sum = emptyTotals()
  const k = emptyTotals()
  const w = emptyTotals()
  for (const r of rows) {
    addTo(sum, r)
    // Excel SUMIF uses the DE flag ($L / mirror of H) for both DE and PL totals,
    // but PL side uses $J (flagPL) — we follow that split.
    const tDE = r.flagDE === 'k' ? k : w
    tDE.forecastDE += r.forecastDE ?? 0
    tDE.forecastDEBereinigt += derive(r).forecastDEBereinigt ?? 0
    tDE.gewichtetDE += derive(r).gewichtetDE ?? 0
    const tPL = r.flagPL === 'k' ? k : w
    tPL.forecastPL += r.forecastPL ?? 0
    tPL.gewichtetPL += derive(r).gewichtetPL ?? 0
  }
  return { sum, k, w }
}

function TotalsRow({
  label,
  totals,
  highlight,
}: {
  label: string
  totals: Totals
  highlight?: boolean
}) {
  const rowCls = highlight ? 'bg-muted/60 font-semibold' : 'bg-muted/20'
  return (
    <tr className={`border-t ${rowCls}`}>
      <td colSpan={5} className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </td>
      <TotCell v={totals.forecastDE} className="border-l" />
      <td />
      <TotCell v={totals.forecastPL} />
      <td />
      <TotCell v={totals.forecastDEBereinigt} />
      <TotCell v={totals.abgerechnetDE} className="border-l" />
      <TotCell v={totals.abgerechnetPL} />
      <TotCell v={totals.abgerechnetDEBereinigt} />
      <TotCell v={totals.nochOffenDE} />
      <td className="border-l" />
      <TotCell v={totals.gewichtetDE} />
      <td />
      <TotCell v={totals.gewichtetPL} />
      <td />
    </tr>
  )
}

function TotCell({ v, className }: { v: number; className?: string }) {
  return (
    <td className={`num px-2 py-2 text-sm ${className ?? ''}`}>
      {v ? fmtEUR(v) : <span className="text-muted-foreground/40">—</span>}
    </td>
  )
}

function ForecastLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="font-medium uppercase tracking-wider">Legende</span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-destructive">
          k
        </span>
        kritisch
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">
          w
        </span>
        wahrscheinlich
      </span>
      <span className="ml-auto">
        Werte in €. Änderungen werden automatisch gespeichert.
      </span>
    </div>
  )
}
