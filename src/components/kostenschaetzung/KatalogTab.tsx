import { useMemo, useRef, useState } from 'react'
import { Info, Search } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'
import katalogData from '@/features/kostenschaetzung/data/katalog.json'
import katalogMeta from '@/features/kostenschaetzung/data/katalogMeta.json'
import type {
  KatalogEntry,
  KatalogMeta,
} from '@/features/kostenschaetzung/types'

const CATALOG = katalogData as KatalogEntry[]
const META = katalogMeta as KatalogMeta
const KATALOG_GRID = '6rem minmax(0, 1fr) 3.5rem 7rem'

const fmtPrice = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

export function KatalogTab() {
  const [q, setQ] = useState('')
  const [rootFilter, setRootFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<KatalogEntry | null>(null)

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return CATALOG.filter((e) => {
      if (rootFilter) {
        const top = (e.kgkPath ?? '').split(' > ')[0]
        if (top !== rootFilter) return false
      }
      if (!needle) return true
      const hay = `${e.kgkCode ?? ''} ${e.bezeichnung ?? ''} ${
        e.kgkBezeichnung ?? ''
      } ${e.erlaeuterung ?? ''}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [q, rootFilter])

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })
  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <Section
      title={META.quelle}
      subtitle={`Preisstand ${META.quartal} · ${META.count} Einträge · schreibgeschützt`}
      padded={false}
      className="flex h-[calc(100vh-180px)] flex-col"
      contentClassName="flex min-h-0 flex-1"
    >
      <aside className="w-56 shrink-0 overflow-y-auto border-r">
        <div className="border-b px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Kostengruppen
        </div>
        <RootButton
          label="Alle KGK"
          count={META.count}
          active={rootFilter === null}
          onClick={() => setRootFilter(null)}
        />
        {META.roots.map((r) => (
          <RootButton
            key={r.name}
            label={r.name}
            count={r.count}
            active={rootFilter === r.name}
            onClick={() => setRootFilter(r.name)}
          />
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="KGK, Bezeichnung, Erläuterung …"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="text-xs tabular-nums text-muted-foreground">
            {results.length} / {META.count}
          </span>
        </div>
        <div
          className="sticky top-0 z-10 grid border-b bg-muted/90 px-2 py-2 text-xs font-medium text-muted-foreground backdrop-blur"
          style={{ gridTemplateColumns: KATALOG_GRID }}
        >
          <div>KGK</div>
          <div>Bezeichnung</div>
          <div>Einh.</div>
          <div className="text-right">Preis · Q3 2026</div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center text-xs text-muted-foreground">
              Keine Ergebnisse.
            </div>
          ) : (
            <div
              className="relative w-full"
              style={{ height: totalSize }}
            >
              {virtualRows.map((vr) => {
                const e = results[vr.index]
                if (!e) return null
                const active = selected?.id === e.id
                return (
                  <div
                    key={e.id}
                    data-index={vr.index}
                    ref={virtualizer.measureElement}
                    onClick={() => setSelected(e)}
                    className={cn(
                      'absolute left-0 right-0 grid cursor-pointer border-b px-2 py-2 text-xs hover:bg-accent/40',
                      active && 'bg-accent/60',
                    )}
                    style={{
                      transform: `translateY(${vr.start}px)`,
                      gridTemplateColumns: KATALOG_GRID,
                    }}
                  >
                    <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {e.kgkCode}
                    </div>
                    <div className="pr-2">
                      <div className="leading-tight">{e.bezeichnung}</div>
                      {e.erlaeuterung && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {e.erlaeuterung}
                        </div>
                      )}
                    </div>
                    <div className="text-muted-foreground">{e.einheit}</div>
                    <div className="text-right font-mono tabular-nums">
                      {fmtPrice(e.preis)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="w-80 shrink-0 overflow-y-auto border-l bg-muted/30">
        {selected ? (
          <div className="space-y-4 p-4 text-sm">
            <Field label="KGK">
              <div className="font-mono">{selected.kgkCode}</div>
              <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {selected.kgkPath}
              </div>
            </Field>

            <Field label="Bezeichnung">
              <div className="font-medium leading-tight">{selected.bezeichnung}</div>
              {selected.erlaeuterung && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {selected.erlaeuterung}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Einheit">
                <span>{selected.einheit ?? '—'}</span>
              </Field>
              <Field label="Preisart">
                <span>{selected.preisart ?? '—'}</span>
              </Field>
            </div>

            <Field label="Preis · Q3 2026">
              <div className="font-mono text-2xl font-semibold tabular-nums">
                {fmtPrice(selected.preis)}
              </div>
            </Field>

            {selected.ansatzGrundlage && (
              <Field label="Ansatzgrundlage">
                <div className="text-xs leading-relaxed">{selected.ansatzGrundlage}</div>
              </Field>
            )}

            {selected.quelle && (
              <Field label="Quelle">
                <div className="text-xs">{selected.quelle}</div>
                {selected.fundstelle && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {selected.fundstelle}
                  </div>
                )}
              </Field>
            )}

            {selected.pruefhinweis && (
              <div className="flex gap-2 rounded border border-amber-500/30 bg-amber-100/60 p-2 dark:bg-amber-500/10">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
                <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                  {selected.pruefhinweis}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
            Wähle einen Eintrag, um Details, Quelle und Prüfhinweis zu sehen.
          </div>
        )}
      </aside>
    </Section>
  )
}

function RootButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'block w-full border-l-2 px-3 py-2 text-left text-sm',
        active
          ? 'border-foreground bg-accent/60 font-medium'
          : 'border-transparent hover:bg-accent/30',
      )}
    >
      <div className="leading-tight">{label}</div>
      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
        {count}
      </div>
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  )
}
