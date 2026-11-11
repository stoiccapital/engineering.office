import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useKostenschaetzung } from '@/kostenschaetzung-store'
import {
  projectSum,
  sectionSum,
} from '@/features/kostenschaetzung/lib/domain'
import { SECTION_TO_KG } from '@/features/kostenschaetzung/lib/kg'
import {
  LEISTUNGSBILDER,
  computeHonorar,
  type Honorarsatz,
  type Zone,
} from '@/features/kostenschaetzung/lib/hoai'
import { NumCell } from '@/components/NumCell'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'

type Row = {
  id: string
  label: string
  lbKey: string
  kosten: number
  zone: Zone
  satz: Honorarsatz
}

const genId = () => Math.random().toString(36).slice(2)

const fmtEUR0 = (v: number): string =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v)

export function HoaiTab() {
  const doc = useKostenschaetzung((s) => s.doc)

  const anrech = useMemo(() => {
    if (!doc) return { anrechOP: 0, anrechTWP: 0, total: 0 }
    let kg300 = 0
    let kg400 = 0
    for (const b of doc.bauwerke) {
      for (const sec of b.sections) {
        const kg = SECTION_TO_KG[sec.lfdNr] ?? 300
        const sum = sectionSum(sec)
        if (kg === 300) kg300 += sum
        if (kg === 400) kg400 += sum
      }
    }
    const anrechOP = kg400 < 0.25 * kg300 ? kg300 + 0.25 * kg400 : kg300 + kg400
    return { anrechOP, anrechTWP: kg300, total: projectSum(doc) }
  }, [doc])

  const ust = doc?.umsatzsteuer ?? 0.19

  const [rows, setRows] = useState<Row[]>([
    {
      id: genId(),
      label: 'Objektplanung · Ingenieurbauwerke',
      lbKey: 'ingenieur',
      kosten: 0,
      zone: 3,
      satz: 'basis',
    },
    {
      id: genId(),
      label: 'Tragwerksplanung',
      lbKey: 'tragwerk',
      kosten: 0,
      zone: 2,
      satz: 'basis',
    },
  ])

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        id: genId(),
        label: 'Freie Berechnung',
        lbKey: 'gebaeude',
        kosten: 0,
        zone: 3,
        satz: 'basis',
      },
    ])
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id))

  const totals = useMemo(() => {
    let netto = 0
    let brutto = 0
    for (const r of rows) {
      const lb = LEISTUNGSBILDER.find((l) => l.key === r.lbKey)
      if (!lb) continue
      const res = computeHonorar(lb, r.kosten, r.zone, r.satz)
      if (res.netto != null) {
        netto += res.netto
        brutto += res.netto * (1 + ust)
      }
    }
    return { netto, brutto }
  }, [rows, ust])

  if (!doc) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <AnrechCard
          label="Anrechenbar OP · §42 HOAI"
          value={anrech.anrechOP}
          action={() => rows[0] && update(rows[0].id, { kosten: Math.round(anrech.anrechOP) })}
        />
        <AnrechCard
          label="Anrechenbar TWP · §50 HOAI"
          value={anrech.anrechTWP}
          action={() => rows[1] && update(rows[1].id, { kosten: Math.round(anrech.anrechTWP) })}
        />
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Gesamtkosten Projekt
          </div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {fmtEUR0(anrech.total)} €
          </div>
        </div>
      </div>

      <Section title="Honorarberechnung" padded={false}>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-muted/60">
              <tr className="border-b text-muted-foreground">
                <th className="px-2 py-2 text-left font-medium">Bezeichnung</th>
                <th className="w-56 px-2 py-2 text-left font-medium">Leistungsbild</th>
                <th className="w-40 px-2 py-2 text-right font-medium">Anr. Kosten</th>
                <th className="w-20 px-2 py-2 text-left font-medium">Zone</th>
                <th className="w-28 px-2 py-2 text-left font-medium">Satz</th>
                <th className="w-36 px-2 py-2 text-right font-medium">Honorar netto</th>
                <th className="w-36 px-2 py-2 text-right font-medium">
                  Brutto (×{(1 + ust).toFixed(2)})
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const lb = LEISTUNGSBILDER.find((l) => l.key === r.lbKey)
                const res = lb ? computeHonorar(lb, r.kosten, r.zone, r.satz) : null
                return (
                  <tr key={r.id} className="group border-b last:border-b-0 hover:bg-accent/30">
                    <td className="px-1.5 py-0.5">
                      <input
                        className="w-full bg-transparent px-2 py-1 text-sm outline-none focus:bg-accent/40 rounded-sm"
                        value={r.label}
                        onChange={(e) => update(r.id, { label: e.target.value })}
                      />
                    </td>
                    <td className="px-1.5 py-0.5">
                      <select
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        value={r.lbKey}
                        onChange={(e) => update(r.id, { lbKey: e.target.value })}
                      >
                        {LEISTUNGSBILDER.map((l) => (
                          <option key={l.key} value={l.key}>
                            {l.paragraph} {l.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1.5 py-0.5">
                      <NumCell
                        value={r.kosten}
                        onChange={(v) => update(r.id, { kosten: v ?? 0 })}
                        decimals={0}
                      />
                    </td>
                    <td className="px-1.5 py-0.5">
                      <select
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        value={r.zone}
                        onChange={(e) =>
                          update(r.id, { zone: Number(e.target.value) as Zone })
                        }
                      >
                        {lb?.zones.map((z) => (
                          <option key={z} value={z}>
                            {['I', 'II', 'III', 'IV', 'V'][z - 1]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1.5 py-0.5">
                      <select
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        value={r.satz}
                        onChange={(e) =>
                          update(r.id, { satz: e.target.value as Honorarsatz })
                        }
                      >
                        <option value="basis">Basis</option>
                        <option value="mittel">Mittel</option>
                        <option value="oberer">Oberer</option>
                      </select>
                    </td>
                    <td className="px-2 py-1 text-right font-mono font-medium tabular-nums">
                      {res?.outOfRange || res?.netto == null
                        ? 'frei vereinb.'
                        : fmtEUR0(res.netto)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums text-muted-foreground">
                      {res?.outOfRange || res?.netto == null
                        ? '—'
                        : fmtEUR0(res.netto * (1 + ust))}
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button
                        onClick={() => remove(r.id)}
                        className="rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label="Zeile entfernen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 bg-muted/60 font-semibold">
                <td colSpan={5} className="px-2 py-2.5 text-right text-sm">
                  Summe
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums">
                  {fmtEUR0(totals.netto)}
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums">
                  {fmtEUR0(totals.brutto)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2">
          <Button variant="ghost" size="sm" onClick={addRow}>
            + Berechnung
          </Button>
          <div className="text-xs text-muted-foreground">
            MwSt {(ust * 100).toFixed(0)} %
          </div>
        </div>
      </Section>

      <div className="rounded-lg border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Hinweise:</strong> Außerhalb der Tafelwerte (§7 Abs. 2 HOAI)
        ist das Honorar frei vereinbar. Angezeigt werden Grundhonorare 100 %
        (alle Leistungsphasen), Honorartafeln HOAI 2021 (identisch mit HOAI 2013).
        Basis = unterer Tafelwert, Oberer = oberer Tafelwert, Mittel = Mittelwert.
      </div>
    </div>
  )
}

function AnrechCard({
  label,
  value,
  action,
}: {
  label: string
  value: number
  action: () => void
}) {
  return (
    <button
      onClick={action}
      className="rounded-lg border bg-muted/30 p-4 text-left hover:border-foreground/40"
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
        {fmtEUR0(value)} €
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Klick → in Zeile übernehmen
      </div>
    </button>
  )
}
