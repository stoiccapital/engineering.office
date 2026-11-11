import { useMemo } from 'react'
import { useKostenschaetzung } from '@/kostenschaetzung-store'
import {
  bauwerkSum,
  projectSum,
  sectionSum,
} from '@/features/kostenschaetzung/lib/domain'
import { KG_KEYS, KG_LABELS, SECTION_TO_KG } from '@/features/kostenschaetzung/lib/kg'
import { Section } from '@/components/ui/section'

const fmtEUR0 = (v: number): string =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v)

export function UebersichtTab() {
  const doc = useKostenschaetzung((s) => s.doc)

  const rollup = useMemo(() => {
    if (!doc) {
      return { perKG: {}, perBauwerk: [], total: 0, anrechOP: 0, anrechTWP: 0 }
    }
    const perKG: Record<number, number> = {
      100: 0, 200: 0, 300: 0, 400: 0, 500: 0, 600: 0, 700: 0, 800: 0,
    }
    const perBauwerk: {
      id: string
      name: string
      perKG: Record<number, number>
      total: number
    }[] = []

    for (const b of doc.bauwerke) {
      const row: Record<number, number> = {
        100: 0, 200: 0, 300: 0, 400: 0, 500: 0, 600: 0, 700: 0, 800: 0,
      }
      for (const sec of b.sections) {
        const kg = SECTION_TO_KG[sec.lfdNr] ?? 300
        const sum = sectionSum(sec)
        row[kg] += sum
        perKG[kg] += sum
      }
      perBauwerk.push({ id: b.id, name: b.name, perKG: row, total: bauwerkSum(b) })
    }

    const kg300 = perKG[300] ?? 0
    const kg400 = perKG[400] ?? 0
    const anrechOP = kg400 < 0.25 * kg300 ? kg300 + 0.25 * kg400 : kg300 + kg400
    const anrechTWP = kg300

    return { perKG, perBauwerk, total: projectSum(doc), anrechOP, anrechTWP }
  }, [doc])

  if (!doc) return null

  return (
    <div className="space-y-6">
      <Section
        title="Kostengruppen (DIN 276)"
        subtitle="Summen je Kostengruppe und Bauwerk"
        padded={false}
      >
        <div className="overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-muted/60">
              <tr className="border-b text-muted-foreground">
                <th className="w-14 px-2 py-2 text-left font-medium">KG</th>
                <th className="px-2 py-2 text-left font-medium">Kostengruppe</th>
                {rollup.perBauwerk.map((b) => (
                  <th
                    key={b.id}
                    className="whitespace-nowrap px-2 py-2 text-right font-medium"
                  >
                    {b.name}
                  </th>
                ))}
                <th className="w-32 px-2 py-2 text-right font-medium">Summe</th>
              </tr>
            </thead>
            <tbody>
              {KG_KEYS.map((kg) => {
                const total = rollup.perKG[kg] ?? 0
                return (
                  <tr key={kg} className="border-b hover:bg-accent/30">
                    <td className="px-2 py-1.5 font-mono tabular-nums text-muted-foreground">
                      {kg}
                    </td>
                    <td className="px-2 py-1.5">{KG_LABELS[kg]}</td>
                    {rollup.perBauwerk.map((b) => (
                      <td
                        key={b.id}
                        className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground"
                      >
                        {b.perKG[kg] ? fmtEUR0(b.perKG[kg]) : '—'}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-mono font-medium tabular-nums">
                      {total ? fmtEUR0(total) : '—'}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 bg-muted/60 font-semibold">
                <td colSpan={2} className="px-2 py-2.5 text-sm">
                  Gesamtkosten
                </td>
                {rollup.perBauwerk.map((b) => (
                  <td
                    key={b.id}
                    className="px-2 py-2.5 text-right font-mono tabular-nums"
                  >
                    {fmtEUR0(b.total)}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-right font-mono tabular-nums">
                  {fmtEUR0(rollup.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Anrechenbare Kosten · HOAI" padded>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <StatCard
            label="Objektplanung · §42 HOAI"
            value={rollup.anrechOP}
            hint="KG 200 + KG 300 + anteilig KG 400"
          />
          <StatCard
            label="Tragwerksplanung · §50 HOAI"
            value={rollup.anrechTWP}
            hint="KG 200 + KG 300"
          />
        </div>
      </Section>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
        {fmtEUR0(value)} €
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
    </div>
  )
}
