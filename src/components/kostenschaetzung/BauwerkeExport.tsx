import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { bauwerkSum, itemSum, sectionSum } from '@/features/kostenschaetzung/lib/domain'
import type { Bauwerk } from '@/features/kostenschaetzung/types'

const fmtEUR2 = (v: number): string =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

const fmtDecimal = (v: number, decimals = 2): string =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)

const fmtDate = (): string =>
  new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

export function BauwerkeExport({
  bauwerk,
  projectName,
  onClose,
}: {
  bauwerk: Bauwerk
  projectName: string
  onClose: () => void
}) {
  const total = bauwerkSum(bauwerk)
  const date = fmtDate()

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Zurück
        </Button>
        <div className="text-xs text-muted-foreground">
          Druckvorschau · ein Dialog öffnet den Systemdruck. „PDF speichern" wählen,
          um die Vorschau als PDF zu exportieren.
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" /> Drucken / PDF speichern
        </Button>
      </div>

      <div className="mx-auto max-w-4xl rounded-lg border bg-white p-10 text-foreground shadow-sm">
        <header>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Kostenschätzung
          </div>
          <h1 className="mt-1 text-2xl font-semibold leading-tight">{bauwerk.name}</h1>
          {bauwerk.km && (
            <div className="mt-0.5 text-sm text-muted-foreground">{bauwerk.km}</div>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Projekt: <strong className="font-medium text-foreground">{projectName}</strong>
            </span>
            <span>·</span>
            <span>Stand: {date}</span>
          </div>
        </header>

        <div className="my-6 h-px bg-border" />

        {bauwerk.sections.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Dieses Bauwerk enthält keine Abschnitte.
          </div>
        ) : (
          bauwerk.sections.map((sec) => {
            const sum = sectionSum(sec)
            return (
              <section key={sec.id} className="mb-6">
                <h2 className="mb-2 text-sm font-semibold">
                  <span className="mr-2 font-mono text-muted-foreground">
                    {sec.lfdNr}.
                  </span>
                  {sec.name}
                </h2>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="w-20 py-1.5 pr-2 text-left font-medium">KGK</th>
                      <th className="py-1.5 pr-2 text-left font-medium">Text</th>
                      <th className="w-16 py-1.5 pr-2 text-right font-medium">Faktor</th>
                      <th className="w-20 py-1.5 pr-2 text-right font-medium">Menge</th>
                      <th className="w-10 py-1.5 pr-2 text-left font-medium">Einh.</th>
                      <th className="w-24 py-1.5 pr-2 text-right font-medium">EP</th>
                      <th className="w-28 py-1.5 text-right font-medium">Summe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-3 text-center text-xs text-muted-foreground"
                        >
                          Keine Positionen.
                        </td>
                      </tr>
                    ) : (
                      sec.items.map((it) => {
                        const summe = itemSum(it)
                        const faktor = it.faktor ?? 1
                        return (
                          <tr key={it.id} className="border-b align-top">
                            <td className="py-1.5 pr-2 font-mono text-[11px] text-muted-foreground">
                              {it.kgk ?? '—'}
                            </td>
                            <td className="py-1.5 pr-2">
                              <div className="leading-tight">{it.text}</div>
                              {it.anmerkung && (
                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                  {it.anmerkung}
                                </div>
                              )}
                              {it.erlaeuterung && (
                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                  {it.erlaeuterung}
                                </div>
                              )}
                            </td>
                            <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                              {fmtDecimal(faktor)}
                            </td>
                            <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                              {fmtDecimal(it.menge)}
                            </td>
                            <td className="py-1.5 pr-2 text-muted-foreground">
                              {it.einheit}
                            </td>
                            <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                              {fmtEUR2(it.einheitspreis)}
                            </td>
                            <td className="py-1.5 text-right font-mono font-medium tabular-nums">
                              {fmtEUR2(summe)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                    {sec.items.length > 0 && (
                      <tr className="border-t font-semibold">
                        <td colSpan={6} className="py-2 pr-2 text-right text-[11px]">
                          Abschnittssumme
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">
                          {fmtEUR2(sum)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )
          })
        )}

        <div className="mt-8 border-t-2 pt-4">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Gesamtsumme
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {fmtEUR2(total)} €
            </div>
          </div>
        </div>

        <footer className="mt-10 border-t pt-3 text-[10px] text-muted-foreground">
          Automatisch generiert am {date} · engineering.office
        </footer>
      </div>
    </div>
  )
}
