import { useMemo } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { useForecast } from '@/store'
import { derive } from '@/types'
import type { ProjectRow } from '@/types'
import { NumCell } from './NumCell'
import { TextCell } from './TextCell'
import { FlagToggle } from './FlagToggle'
import { fmtEUR } from '@/lib/format'

type ColGroup = { label: string; span: number; className?: string }

const groups: ColGroup[] = [
  { label: 'Projekt', span: 5 },
  { label: 'Forecast', span: 5, className: 'bg-blue-50/60' },
  { label: 'Abgerechnet', span: 4, className: 'bg-emerald-50/60' },
  { label: 'Leistungsstand', span: 4, className: 'bg-amber-50/60' },
  { label: '', span: 1 },
]

export function ForecastTable() {
  const period = useForecast((s) => s.period)
  const addRow = useForecast((s) => s.addRow)
  const updateRow = useForecast((s) => s.updateRow)
  const deleteRow = useForecast((s) => s.deleteRow)
  const setFlag = useForecast((s) => s.setFlag)

  const rows = period?.rows ?? []

  const totals = useMemo(() => computeTotals(rows), [rows])

  return (
    <div className="w-full overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[1800px] border-collapse text-sm">
        <colgroup>
          <col className="w-14" /> {/* PL DE */}
          <col className="w-14" /> {/* PL PL */}
          <col className="w-52" /> {/* Projektname */}
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

        <thead>
          <tr className="border-b">
            {groups.map((g, i) => (
              <th
                key={i}
                colSpan={g.span}
                className={`px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${g.className ?? ''}`}
              >
                {g.label}
              </th>
            ))}
          </tr>
          <tr className="border-b bg-muted/40">
            <Th>PL DE</Th>
            <Th>PL PLN</Th>
            <Th>Projektname</Th>
            <Th>Proj. Nr.</Th>
            <Th>Leistung in Worten</Th>
            <Th className="num">Forecast DE</Th>
            <Th>k/w</Th>
            <Th className="num">Forecast PL</Th>
            <Th>k/w</Th>
            <Th className="num text-muted-foreground">DE bereinigt</Th>
            <Th className="num">Abgerechnet DE</Th>
            <Th className="num">Abgerechnet PL</Th>
            <Th className="num text-muted-foreground">Abg. bereinigt</Th>
            <Th className="num text-muted-foreground">Noch offen DE</Th>
            <Th className="num">% DE</Th>
            <Th className="num text-muted-foreground">Gewichtet DE</Th>
            <Th className="num">% PL</Th>
            <Th className="num text-muted-foreground">Gewichtet PL</Th>
            <Th></Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              onUpdate={(patch) => updateRow(row.id, patch)}
              onFlag={(which, flag) => setFlag(row.id, which, flag)}
              onDelete={() => deleteRow(row.id)}
            />
          ))}
          <tr>
            <td colSpan={19} className="p-0">
              <button
                onClick={addRow}
                className="flex w-full items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Projekt hinzufügen
              </button>
            </td>
          </tr>
        </tbody>

        <tfoot className="border-t-2 border-foreground/20">
          <TotalsRow label="Summe" totals={totals.sum} highlight />
          <TotalsRow label="k — kritisch" totals={totals.k} />
          <TotalsRow label="w — wahrscheinlich" totals={totals.w} />
        </tfoot>
      </table>
    </div>
  )
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground ${className ?? ''}`}
    >
      {children}
    </th>
  )
}

function Row({
  row,
  onUpdate,
  onFlag,
  onDelete,
}: {
  row: ProjectRow
  onUpdate: (patch: Partial<ProjectRow>) => void
  onFlag: (which: 'flagDE' | 'flagPL', flag: ProjectRow['flagDE']) => void
  onDelete: () => void
}) {
  const d = derive(row)
  return (
    <tr className="border-b last:border-b-0 hover:bg-accent/20">
      <Td>
        <TextCell value={row.projektleiterDE} onChange={(v) => onUpdate({ projektleiterDE: v })} placeholder="…" />
      </Td>
      <Td>
        <TextCell value={row.projektleiterPL} onChange={(v) => onUpdate({ projektleiterPL: v })} placeholder="…" />
      </Td>
      <Td>
        <TextCell value={row.projektname} onChange={(v) => onUpdate({ projektname: v })} placeholder="Projektname" />
      </Td>
      <Td>
        <TextCell value={row.projNr} onChange={(v) => onUpdate({ projNr: v })} placeholder="26D000" className="font-mono text-xs" />
      </Td>
      <Td>
        <TextCell
          value={row.leistung}
          onChange={(v) => onUpdate({ leistung: v })}
          placeholder="Leistung in Worten"
        />
      </Td>

      <Td className="bg-blue-50/40">
        <NumCell value={row.forecastDE} onChange={(v) => onUpdate({ forecastDE: v })} />
      </Td>
      <Td className="bg-blue-50/40">
        <div className="flex justify-center">
          <FlagToggle value={row.flagDE} onChange={(f) => onFlag('flagDE', f)} compact />
        </div>
      </Td>
      <Td className="bg-blue-50/40">
        <NumCell value={row.forecastPL} onChange={(v) => onUpdate({ forecastPL: v })} />
      </Td>
      <Td className="bg-blue-50/40">
        <div className="flex justify-center">
          <FlagToggle value={row.flagPL} onChange={(f) => onFlag('flagPL', f)} compact />
        </div>
      </Td>
      <Td className="bg-blue-50/40">
        <NumCell value={d.forecastDEBereinigt} readOnly />
      </Td>

      <Td className="bg-emerald-50/40">
        <NumCell value={row.abgerechnetDE} onChange={(v) => onUpdate({ abgerechnetDE: v })} />
      </Td>
      <Td className="bg-emerald-50/40">
        <NumCell value={row.abgerechnetPL} onChange={(v) => onUpdate({ abgerechnetPL: v })} />
      </Td>
      <Td className="bg-emerald-50/40">
        <NumCell value={d.abgerechnetDEBereinigt} readOnly />
      </Td>
      <Td className="bg-emerald-50/40">
        <NumCell value={d.nochOffenDE} readOnly />
      </Td>

      <Td className="bg-amber-50/40">
        <NumCell value={row.leistungsstandDE} onChange={(v) => onUpdate({ leistungsstandDE: v })} pct />
      </Td>
      <Td className="bg-amber-50/40">
        <NumCell value={d.gewichtetDE} readOnly />
      </Td>
      <Td className="bg-amber-50/40">
        <NumCell value={row.leistungsstandPL} onChange={(v) => onUpdate({ leistungsstandPL: v })} pct />
      </Td>
      <Td className="bg-amber-50/40">
        <NumCell value={d.gewichtetPL} readOnly />
      </Td>
      <Td>
        <button
          onClick={onDelete}
          className="rounded-md p-1.5 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
          title="Zeile löschen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </Td>
    </tr>
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
      <td colSpan={5} className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </td>
      <TotCell v={totals.forecastDE} cls="bg-blue-50/60" />
      <td className="bg-blue-50/60" />
      <TotCell v={totals.forecastPL} cls="bg-blue-50/60" />
      <td className="bg-blue-50/60" />
      <TotCell v={totals.forecastDEBereinigt} cls="bg-blue-50/60" />
      <TotCell v={totals.abgerechnetDE} cls="bg-emerald-50/60" />
      <TotCell v={totals.abgerechnetPL} cls="bg-emerald-50/60" />
      <TotCell v={totals.abgerechnetDEBereinigt} cls="bg-emerald-50/60" />
      <TotCell v={totals.nochOffenDE} cls="bg-emerald-50/60" />
      <td className="bg-amber-50/60" />
      <TotCell v={totals.gewichtetDE} cls="bg-amber-50/60" />
      <td className="bg-amber-50/60" />
      <TotCell v={totals.gewichtetPL} cls="bg-amber-50/60" />
      <td />
    </tr>
  )
}

function TotCell({ v, cls }: { v: number; cls?: string }) {
  return (
    <td className={`num px-2 py-2 text-sm tabular-nums ${cls ?? ''}`}>
      {v ? fmtEUR(v) : <span className="text-muted-foreground/40">—</span>}
    </td>
  )
}
