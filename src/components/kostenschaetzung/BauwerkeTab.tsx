import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useKostenschaetzung } from '@/kostenschaetzung-store'
import { bauwerkSum, itemSum, sectionSum } from '@/features/kostenschaetzung/lib/domain'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { NumCell } from '@/components/NumCell'
import { TextCell } from '@/components/TextCell'
import { cn } from '@/lib/utils'
import { KatalogPicker } from './KatalogPicker'

const fmtEUR2 = (v: number): string =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

const fmtEUR0 = (v: number): string =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v)

export function BauwerkeTab() {
  const doc = useKostenschaetzung((s) => s.doc)
  const activeId = useKostenschaetzung((s) => s.activeBauwerkId)
  const setActive = useKostenschaetzung((s) => s.setActiveBauwerk)
  const addBauwerk = useKostenschaetzung((s) => s.addBauwerk)
  const renameBauwerk = useKostenschaetzung((s) => s.renameBauwerk)
  const removeBauwerk = useKostenschaetzung((s) => s.removeBauwerk)
  const duplicateBauwerk = useKostenschaetzung((s) => s.duplicateBauwerk)
  const addSection = useKostenschaetzung((s) => s.addSection)
  const renameSection = useKostenschaetzung((s) => s.renameSection)
  const removeSection = useKostenschaetzung((s) => s.removeSection)
  const addItem = useKostenschaetzung((s) => s.addItem)
  const updateItem = useKostenschaetzung((s) => s.updateItem)
  const removeItem = useKostenschaetzung((s) => s.removeItem)

  const [openSection, setOpenSection] = useState<string | null>(null)
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null)

  const bauwerk = useMemo(
    () => doc?.bauwerke.find((b) => b.id === activeId) ?? null,
    [doc, activeId],
  )
  const total = bauwerk ? bauwerkSum(bauwerk) : 0

  if (!doc) return null

  return (
    <div className="space-y-4">
      <Section
        padded={false}
        contentClassName="flex items-center gap-2 px-4 py-3"
        className="bg-card"
      >
        <select
          value={activeId ?? ''}
          onChange={(e) => setActive(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {doc.bauwerke.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addBauwerk('Neues Bauwerk')}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Bauwerk
        </Button>
        {bauwerk && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => duplicateBauwerk(bauwerk.id)}
            >
              <Copy className="mr-1 h-3.5 w-3.5" /> Duplizieren
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeBauwerk(bauwerk.id)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Löschen
            </Button>
          </>
        )}
        <div className="flex-1" />
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Summe
          </div>
          <div className="font-mono text-base font-semibold tabular-nums">
            {fmtEUR0(total)} €
          </div>
        </div>
      </Section>

      {bauwerk ? (
        <>
          <Section
            title={
              <input
                className="w-full bg-transparent text-sm font-semibold outline-none"
                value={bauwerk.name}
                onChange={(e) => renameBauwerk(bauwerk.id, e.target.value, bauwerk.km)}
              />
            }
            subtitle={
              <input
                className="w-full bg-transparent text-xs text-muted-foreground outline-none"
                placeholder="z. B. km 26,189 – 26,367"
                value={bauwerk.km ?? ''}
                onChange={(e) => renameBauwerk(bauwerk.id, bauwerk.name, e.target.value)}
              />
            }
            padded={false}
            contentClassName="divide-y"
          >
            {bauwerk.sections.map((sec) => {
              const open = openSection === sec.id
              const sum = sectionSum(sec)
              return (
                <div key={sec.id}>
                  <button
                    onClick={() => setOpenSection(open ? null : sec.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/30"
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="w-6 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {sec.lfdNr}
                    </span>
                    <span className="flex-1 text-sm font-medium">{sec.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {sec.items.length} Pos.
                    </span>
                    <span className="w-36 text-right font-mono text-sm font-semibold tabular-nums">
                      {fmtEUR0(sum)} €
                    </span>
                  </button>

                  {open && (
                    <div className="border-t bg-muted/20">
                      <div className="flex items-center gap-2 px-4 py-2">
                        <input
                          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                          value={sec.name}
                          onChange={(e) =>
                            renameSection(bauwerk.id, sec.id, e.target.value)
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPickerSectionId(sec.id)}
                        >
                          <Search className="mr-1 h-3.5 w-3.5" /> Katalog
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => addItem(bauwerk.id, sec.id, { text: 'Neue Position' })}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> Position
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSection(bauwerk.id, sec.id)}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Abschnitt löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <PositionsTable
                        bauwerkId={bauwerk.id}
                        section={sec}
                        onUpdate={updateItem}
                        onRemove={removeItem}
                        sum={sum}
                      />
                    </div>
                  )}
                </div>
              )
            })}
            <div className="px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => addSection(bauwerk.id, 'Neuer Abschnitt')}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Abschnitt
              </Button>
            </div>
          </Section>
        </>
      ) : (
        <Section padded>
          <div className="py-8 text-center text-sm text-muted-foreground">
            Noch kein Bauwerk. Lege eines mit „+ Bauwerk" an.
          </div>
        </Section>
      )}

      <KatalogPicker
        open={pickerSectionId !== null}
        onOpenChange={(v) => {
          if (!v) setPickerSectionId(null)
        }}
        onPick={(entry) => {
          if (!bauwerk || !pickerSectionId) return
          addItem(bauwerk.id, pickerSectionId, {
            kgk: entry.kgkCode,
            text: entry.bezeichnung,
            einheit: entry.einheit ?? '',
            einheitspreis: entry.preis ?? 0,
            erlaeuterung: entry.erlaeuterung,
          })
        }}
      />
    </div>
  )
}

function PositionsTable({
  bauwerkId,
  section,
  onUpdate,
  onRemove,
  sum,
}: {
  bauwerkId: string
  section: import('@/features/kostenschaetzung/types').Section
  onUpdate: (
    bauwerkId: string,
    sectionId: string,
    id: string,
    patch: Partial<import('@/features/kostenschaetzung/types').LineItem>,
  ) => void
  onRemove: (bauwerkId: string, sectionId: string, id: string) => void
  sum: number
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-muted/60">
          <tr className="border-y text-muted-foreground">
            <Th className="w-24 text-left">KGK</Th>
            <Th className="text-left">Text</Th>
            <Th className="w-20 text-right">Faktor</Th>
            <Th className="w-40 text-left">Anmerkung</Th>
            <Th className="w-24 text-right">Menge</Th>
            <Th className="w-14 text-left">Einh.</Th>
            <Th className="w-28 text-right">Einheitspreis</Th>
            <Th className="w-32 text-right">Summe</Th>
            <Th className="w-56 text-left">Erläuterung</Th>
            <Th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {section.items.map((it) => {
            const summe = itemSum(it)
            return (
              <tr key={it.id} className="group border-b last:border-b-0 hover:bg-accent/30">
                <td className="px-1.5 py-0.5">
                  <TextCell
                    value={it.kgk ?? ''}
                    onChange={(v) =>
                      onUpdate(bauwerkId, section.id, it.id, { kgk: v || null })
                    }
                    className="font-mono text-[11px]"
                  />
                </td>
                <td className="px-1.5 py-0.5">
                  <TextCell
                    value={it.text}
                    onChange={(v) => onUpdate(bauwerkId, section.id, it.id, { text: v })}
                  />
                </td>
                <td className="px-1.5 py-0.5">
                  <NumCell
                    value={it.faktor}
                    onChange={(v) =>
                      onUpdate(bauwerkId, section.id, it.id, { faktor: v ?? 1 })
                    }
                    decimals={2}
                  />
                </td>
                <td className="px-1.5 py-0.5">
                  <TextCell
                    value={it.anmerkung ?? ''}
                    onChange={(v) =>
                      onUpdate(bauwerkId, section.id, it.id, { anmerkung: v || null })
                    }
                  />
                </td>
                <td className="px-1.5 py-0.5">
                  <NumCell
                    value={it.menge}
                    onChange={(v) =>
                      onUpdate(bauwerkId, section.id, it.id, { menge: v ?? 0 })
                    }
                    decimals={2}
                  />
                </td>
                <td className="px-1.5 py-0.5">
                  <TextCell
                    value={it.einheit}
                    onChange={(v) => onUpdate(bauwerkId, section.id, it.id, { einheit: v })}
                  />
                </td>
                <td className="px-1.5 py-0.5">
                  <NumCell
                    value={it.einheitspreis}
                    onChange={(v) =>
                      onUpdate(bauwerkId, section.id, it.id, { einheitspreis: v ?? 0 })
                    }
                    decimals={2}
                  />
                </td>
                <td className="px-2 py-1 text-right font-mono text-sm font-medium tabular-nums">
                  {fmtEUR2(summe)}
                </td>
                <td className="px-1.5 py-0.5">
                  <TextCell
                    value={it.erlaeuterung ?? ''}
                    onChange={(v) =>
                      onUpdate(bauwerkId, section.id, it.id, { erlaeuterung: v || null })
                    }
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  <button
                    onClick={() => onRemove(bauwerkId, section.id, it.id)}
                    className="rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Position löschen"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            )
          })}
          {section.items.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-xs text-muted-foreground">
                Keine Positionen. „+ Position" oder „Katalog" nutzen.
              </td>
            </tr>
          )}
          {section.items.length > 0 && (
            <tr className="border-t bg-muted/40">
              <td colSpan={7} className="px-2 py-2 text-right text-[11px] font-medium text-muted-foreground">
                Abschnittssumme
              </td>
              <td className="px-2 py-2 text-right font-mono text-sm font-semibold tabular-nums">
                {fmtEUR2(sum)}
              </td>
              <td colSpan={2} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th className={cn('px-2 py-2 font-medium', className)}>{children}</th>
  )
}
