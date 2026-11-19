import { useKostenermittlung } from '@/kostenermittlung-store'
import { Section } from '@/components/ui/section'
import { TextCell } from '@/components/TextCell'
import { NumCell } from '@/components/NumCell'
import { useAccess } from '@/access-store'
import { useEffect, useState } from 'react'
import { loadKatalog, type KatalogMeta } from '@/features/kostenermittlung/lib/katalog'
import { cn } from '@/lib/utils'

const ARTEN = ['Kostenschätzung', 'Kostenberechnung', 'Kostenanschlag'] as const

export function ProjektTab() {
  const doc = useKostenermittlung((s) => s.doc)
  const setKopf = useKostenermittlung((s) => s.setKopf)
  const currentUser = useAccess((s) => s.currentUser)
  const [meta, setMeta] = useState<KatalogMeta | null>(null)

  // Default "Bearbeitet von" to the signed-in user once, if the field is blank.
  useEffect(() => {
    if (!doc) return
    if (!doc.kopf.bearbeitetVon && currentUser?.displayName) {
      setKopf({ bearbeitetVon: currentUser.displayName })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.kopf.bearbeitetVon, currentUser?.displayName])

  // Load the catalog meta so we can tell the user whether their Projektpreisstand
  // matches the database.
  useEffect(() => {
    let cancelled = false
    void loadKatalog().then((k) => {
      if (!cancelled) setMeta(k.meta)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!doc) return null
  const k = doc.kopf
  const preisstandMatch = meta ? normalizeQuartal(k.projektpreisstand) === meta.quartal : null

  return (
    <div className="max-w-3xl space-y-4">
      <Section title="Projektkopf">
        <div className="grid grid-cols-[180px_1fr] gap-x-6 gap-y-3 text-sm">
          <Label>Projekt</Label>
          <TextCell value={k.projekt} onChange={(v) => setKopf({ projekt: v })} />

          <Label>Projektnummer</Label>
          <TextCell
            value={k.projektnummer}
            onChange={(v) => setKopf({ projektnummer: v })}
          />

          <Label>Auftraggeber</Label>
          <TextCell
            value={k.auftraggeber}
            onChange={(v) => setKopf({ auftraggeber: v })}
          />

          <Label>Ermittlungsart</Label>
          <select
            value={k.ermittlungsart}
            onChange={(e) =>
              setKopf({ ermittlungsart: e.target.value as (typeof ARTEN)[number] })
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {ARTEN.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <Label>Bearbeitet von</Label>
          <TextCell
            value={k.bearbeitetVon}
            onChange={(v) => setKopf({ bearbeitetVon: v })}
          />

          <Label>Datum</Label>
          <input
            type="date"
            value={k.datum}
            onChange={(e) => setKopf({ datum: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />

          <Label>Projektpreisstand</Label>
          <div className="space-y-1">
            <TextCell
              value={k.projektpreisstand}
              onChange={(v) => setKopf({ projektpreisstand: v })}
              placeholder="z.B. Q3/2026"
            />
            {meta && (
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]',
                  preisstandMatch
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    preisstandMatch ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                />
                Katalog: {meta.quartal}
                {preisstandMatch
                  ? ' · stimmt überein'
                  : ` · weicht ab (Positionen stammen aus ${meta.quartal})`}
              </div>
            )}
          </div>

          <Label>USt-Satz</Label>
          <div className="flex items-center gap-2">
            <div className="w-32">
              <NumCell
                value={k.umsatzsteuer}
                onChange={(v) => setKopf({ umsatzsteuer: v })}
                pct
              />
            </div>
            <button
              type="button"
              onClick={() => setKopf({ umsatzsteuer: null })}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              leer
            </button>
          </div>
        </div>
      </Section>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-9 items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

// Normalize user input like "Q3 2026", "q3/2026" → "Q3/2026" for the match check.
function normalizeQuartal(v: string): string {
  const m = v.trim().match(/^q?\s*([1-4])[\s/\-.]*([0-9]{2,4})$/i)
  if (!m) return v.trim()
  const q = m[1]
  const y = m[2].length === 2 ? '20' + m[2] : m[2]
  return `Q${q}/${y}`
}
