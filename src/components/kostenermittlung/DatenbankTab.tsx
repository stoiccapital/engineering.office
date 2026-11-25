import { useEffect, useMemo, useRef, useState } from 'react'
import { Info, Search } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'
import {
  loadKatalog,
  type Katalog,
  type KgkEntry,
} from '@/features/kostenermittlung/lib/katalog'
import { HAUPTGRUPPEN } from '@/features/kostenermittlung/lib/kgk'
import { useFullscreen } from '@/components/ui/use-fullscreen'
import { FullscreenToggle } from '@/components/ui/fullscreen-toggle'

const KATALOG_GRID = '6rem minmax(0, 1fr) 3.5rem 7rem'

const fmtPrice = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

function formatRange(von: number | null, bis: number | null): string {
  if (von === null && bis === null) return '—'
  if (von !== null && bis !== null && von !== bis) {
    return `${fmtPrice(von)} – ${fmtPrice(bis)}`
  }
  return fmtPrice(von ?? bis ?? 0)
}

export function DatenbankTab() {
  const { ref: containerRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>()
  const [katalog, setKatalog] = useState<Katalog | null>(null)
  const [q, setQ] = useState('')
  const [rootFilter, setRootFilter] = useState<number | null>(null)
  const [selected, setSelected] = useState<KgkEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadKatalog().then((k) => {
      if (!cancelled) setKatalog(k)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const results = useMemo(() => {
    if (!katalog) return [] as KgkEntry[]
    const needle = q.trim().toLowerCase()
    return katalog.kgk.filter((e) => {
      if (rootFilter !== null && Number(e.code[0]) !== rootFilter) return false
      if (!needle) return true
      const hay = `${e.code} ${e.bezeichnung} ${e.pfad ?? ''} ${
        e.anmerkung ?? ''
      }`.toLowerCase()
      return hay.includes(needle)
    })
  }, [katalog, q, rootFilter])

  const countsByHauptgruppe = useMemo(() => {
    const counts: Record<number, number> = {}
    if (!katalog) return counts
    for (const e of katalog.kgk) {
      const h = Number(e.code[0])
      counts[h] = (counts[h] ?? 0) + 1
    }
    return counts
  }, [katalog])

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })
  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  const meta = katalog?.meta

  return (
    <div
      ref={containerRef}
      className={cn(isFullscreen && 'flex h-screen w-screen flex-col bg-background p-4')}
    >
    <Section
      title={meta?.quelle ?? 'Datenbank Ril 808'}
      subtitle={
        meta
          ? `Preisstand ${meta.quartal} · ${meta.kgkCount.toLocaleString('de-DE')} Einträge · schreibgeschützt`
          : 'Lade Katalog …'
      }
      padded={false}
      className={cn(
        'flex flex-col',
        isFullscreen ? 'min-h-0 flex-1' : 'h-[calc(100vh-180px)]',
      )}
      contentClassName="flex min-h-0 flex-1"
      action={<FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />}
    >
      <aside className="w-56 shrink-0 overflow-y-auto border-r">
        <div className="border-b px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Kostengruppen
        </div>
        <RootButton
          label="Alle KGK"
          count={katalog?.meta.kgkCount ?? 0}
          active={rootFilter === null}
          onClick={() => setRootFilter(null)}
        />
        {HAUPTGRUPPEN.map((h) => (
          <RootButton
            key={h.nummer}
            label={h.name}
            count={countsByHauptgruppe[h.nummer] ?? 0}
            active={rootFilter === h.nummer}
            onClick={() => setRootFilter(h.nummer)}
          />
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="KGK, Bezeichnung, Pfad oder Anmerkung …"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="text-xs tabular-nums text-muted-foreground">
            {results.length} / {katalog?.meta.kgkCount ?? 0}
          </span>
        </div>
        <div
          className="sticky top-0 z-10 grid border-b bg-muted/90 px-2 py-2 text-xs font-medium text-muted-foreground backdrop-blur"
          style={{ gridTemplateColumns: KATALOG_GRID }}
        >
          <div>KGK</div>
          <div>Bezeichnung</div>
          <div>Einh.</div>
          <div className="text-right">
            Preis · {katalog?.meta.quartal ?? ''}
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center text-xs text-muted-foreground">
              Keine Ergebnisse.
            </div>
          ) : (
            <div className="relative w-full" style={{ height: totalSize }}>
              {virtualRows.map((vr) => {
                const e = results[vr.index]
                if (!e) return null
                const active = selected?.code === e.code
                return (
                  <div
                    key={e.code + ':' + vr.index}
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
                      {e.code}
                    </div>
                    <div className="pr-2">
                      <div className="leading-tight">{e.bezeichnung}</div>
                      {e.anmerkung && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {e.anmerkung}
                        </div>
                      )}
                    </div>
                    <div className="text-muted-foreground">{e.einheit}</div>
                    <div className="text-right font-mono tabular-nums">
                      {formatRange(e.epVon, e.epBis)}
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
              <div className="font-mono">{selected.code}</div>
              <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {selected.pfad}
              </div>
            </Field>

            <Field label="Bezeichnung">
              <div className="font-medium leading-tight">{selected.bezeichnung}</div>
              {selected.anmerkung && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {selected.anmerkung}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Einheit">
                <span>{selected.einheit ?? '—'}</span>
              </Field>
              <Field label="Ebene">
                <span>{selected.ebene}</span>
              </Field>
            </div>

            <Field label={`Preis · ${katalog?.meta.quartal ?? ''}`}>
              <div className="font-mono text-2xl font-semibold tabular-nums">
                {formatRange(selected.epVon, selected.epBis)}
              </div>
            </Field>

            {(selected.epAktuellVon !== null || selected.epAktuellBis !== null) && (
              <Field label="Preis · AKTUELL">
                <div className="font-mono text-lg font-semibold tabular-nums">
                  {formatRange(selected.epAktuellVon, selected.epAktuellBis)}
                </div>
              </Field>
            )}

            {selected.kostengliederung && (
              <Field label="Kostengliederung">
                <div className="font-mono text-xs">{selected.kostengliederung}</div>
              </Field>
            )}

            {selected.parent && (
              <Field label="Übergeordneter KGK">
                <div className="font-mono text-xs">{selected.parent}</div>
              </Field>
            )}

            {selected.faktor !== null && (
              <Field label="Faktor">
                <div className="font-mono text-xs tabular-nums">
                  {new Intl.NumberFormat('de-DE', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 2,
                  }).format(selected.faktor)}
                </div>
              </Field>
            )}

            {selected.anmerkung && (
              <div className="flex gap-2 rounded border border-amber-500/30 bg-amber-100/60 p-2 dark:bg-amber-500/10">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
                <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                  {selected.anmerkung}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
            Wähle einen Eintrag, um Details zu sehen.
          </div>
        )}
      </aside>
    </Section>
    </div>
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
