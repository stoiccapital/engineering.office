import { useEffect, useMemo, useState } from 'react'
import { useKostenermittlung } from '@/kostenermittlung-store'
import {
  byEbene2,
  byHauptgruppe,
  openPositionCount,
  status,
  totalNetto,
} from '@/features/kostenermittlung/lib/rollup'
import { Section } from '@/components/ui/section'
import { KPICard, KPIGrid } from '@/components/ui/kpi-card'
import { cn } from '@/lib/utils'
import { loadKatalog, type Katalog } from '@/features/kostenermittlung/lib/katalog'

const fmtEUR2 = (v: number): string =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

const fmtPct1 = (v: number): string =>
  new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(v)

export function UebersichtTab() {
  const doc = useKostenermittlung((s) => s.doc)
  const [katalog, setKatalog] = useState<Katalog | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadKatalog().then((k) => {
      if (!cancelled) setKatalog(k)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const abdeckung = useMemo(() => {
    if (!doc || !katalog) return null
    const total = doc.positionen.length
    if (total === 0) return { total: 0, hits: 0, ratio: 0 }
    const hits = doc.positionen.filter(
      (p) => p.kgk !== null && katalog.kgkByCode.has(p.kgk),
    ).length
    return { total, hits, ratio: hits / total }
  }, [doc, katalog])

  const kpis = useMemo(() => {
    if (!doc)
      return { netto: 0, positionen: 0, offen: 0, brutto: null, ust: null, stand: 'leer' as const }
    const netto = totalNetto(doc)
    const offen = openPositionCount(doc)
    const ustSatz = doc.kopf.umsatzsteuer
    const ust = ustSatz !== null ? netto * ustSatz : null
    const brutto = ust !== null ? netto + ust : null
    return {
      netto,
      positionen: doc.positionen.length,
      offen,
      ust,
      brutto,
      stand: status(doc),
    }
  }, [doc])

  const hauptgruppen = useMemo(() => (doc ? byHauptgruppe(doc) : []), [doc])
  const ebene2 = useMemo(() => (doc ? byEbene2(doc) : []), [doc])

  if (!doc) return null

  const stand =
    kpis.stand === 'vollständig'
      ? { label: 'Alle Ansätze berechnet', tone: 'emerald' as const }
      : kpis.stand === 'leer'
        ? { label: 'Noch keine Kostenansätze', tone: 'muted' as const }
        : {
            label: `Unvollständig · ${kpis.offen} Position${kpis.offen === 1 ? '' : 'en'} offen`,
            tone: 'danger' as const,
          }

  return (
    <div className="space-y-6">
      <Section title={doc.kopf.projekt} subtitle={headerSub(doc)}>
        <KPIGrid>
          <KPICard
            label="Kosten netto"
            value={fmtEUR2(kpis.netto)}
            unit="€"
          />
          <KPICard
            label="Positionen"
            value={String(kpis.positionen)}
            sub={kpis.offen > 0 ? `${kpis.offen} offen` : undefined}
            tone={kpis.offen > 0 ? 'danger' : undefined}
          />
          <KPICard
            label={`USt. ${doc.kopf.umsatzsteuer !== null ? fmtPct1(doc.kopf.umsatzsteuer) : ''}`}
            value={kpis.ust !== null ? fmtEUR2(kpis.ust) : '—'}
            unit={kpis.ust !== null ? '€' : undefined}
          />
          <KPICard
            label="Kosten brutto"
            value={kpis.brutto !== null ? fmtEUR2(kpis.brutto) : '—'}
            unit={kpis.brutto !== null ? '€' : undefined}
          />
          <KPICard
            label="Katalog-Abdeckung"
            value={
              abdeckung === null
                ? '—'
                : abdeckung.total === 0
                  ? '—'
                  : fmtPct1(abdeckung.ratio)
            }
            sub={
              abdeckung && abdeckung.total > 0
                ? `${abdeckung.hits} / ${abdeckung.total} Positionen mit Katalog-KGK`
                : katalog
                  ? `Preisstand ${katalog.meta.quartal}`
                  : undefined
            }
          />
        </KPIGrid>
        <div className="mt-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
              stand.tone === 'emerald' &&
                'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              stand.tone === 'danger' &&
                'border-destructive/30 bg-destructive/10 text-destructive',
              stand.tone === 'muted' && 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                stand.tone === 'emerald' && 'bg-emerald-500',
                stand.tone === 'danger' && 'bg-destructive',
                stand.tone === 'muted' && 'bg-muted-foreground/50',
              )}
            />
            Bearbeitungsstand: {stand.label}
          </span>
        </div>
      </Section>

      <Section title="Kosten nach Hauptgruppen">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <Th className="w-[110px]">KGK-Code</Th>
              <Th>Hauptgruppe</Th>
              <Th className="w-[160px] text-right">Kosten netto</Th>
              <Th className="w-[80px] text-right">Anteil</Th>
              <Th className="w-[80px] text-right">Pos.</Th>
            </tr>
          </thead>
          <tbody>
            {hauptgruppen.map((h) => (
              <tr key={h.code} className="border-b">
                <Td className="font-mono tabular-nums text-muted-foreground">
                  {h.code}
                </Td>
                <Td>{h.name}</Td>
                <Td className="text-right font-mono tabular-nums">
                  {h.kosten ? fmtEUR2(h.kosten) : ''}
                </Td>
                <Td className="text-right font-mono tabular-nums text-muted-foreground">
                  {h.kosten ? fmtPct1(h.anteil) : ''}
                </Td>
                <Td className="text-right font-mono tabular-nums text-muted-foreground">
                  {h.count || ''}
                </Td>
              </tr>
            ))}
            <tr>
              <Td />
              <Td className="font-semibold">Summe Hauptgruppen</Td>
              <Td className="text-right font-mono tabular-nums font-semibold">
                {fmtEUR2(kpis.netto)}
              </Td>
              <Td />
              <Td />
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Kosten nach zweiter Kostengliederungsebene">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <Th className="w-[110px]">KGK-Code</Th>
              <Th>Kostengruppe / direkte Ansätze</Th>
              <Th className="w-[160px] text-right">Kosten netto</Th>
              <Th className="w-[80px] text-right">Pos.</Th>
            </tr>
          </thead>
          <tbody>
            {ebene2.map((r) => (
              <tr
                key={`${r.hauptgruppe}:${r.code}`}
                className={cn('border-b', r.sammler && 'bg-muted/30 font-medium')}
              >
                <Td className="font-mono tabular-nums text-muted-foreground">
                  {r.code}
                </Td>
                <Td>{r.name}</Td>
                <Td className="text-right font-mono tabular-nums">
                  {r.kosten ? fmtEUR2(r.kosten) : ''}
                </Td>
                <Td className="text-right font-mono tabular-nums text-muted-foreground">
                  {r.count || ''}
                </Td>
              </tr>
            ))}
            <tr>
              <Td />
              <Td className="font-semibold">Summe Ebene 2 und direkte Ansätze</Td>
              <Td className="text-right font-mono tabular-nums font-semibold">
                {fmtEUR2(kpis.netto)}
              </Td>
              <Td />
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  )
}

function headerSub(doc: {
  kopf: {
    projektnummer: string
    auftraggeber: string
    ermittlungsart: string
    bearbeitetVon: string
    datum: string
    projektpreisstand: string
  }
}): string {
  const k = doc.kopf
  return [
    k.projektnummer && `Nr. ${k.projektnummer}`,
    k.auftraggeber,
    k.ermittlungsart,
    k.projektpreisstand,
    k.bearbeitetVon && `Bearbeitet: ${k.bearbeitetVon}`,
    k.datum,
  ]
    .filter(Boolean)
    .join(' · ')
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn('border-b px-2 pb-2 text-left font-medium', className)}>
      {children}
    </th>
  )
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-2 py-1.5', className)}>{children}</td>
}
