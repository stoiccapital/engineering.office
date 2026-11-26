import { useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  defaultPrice,
  loadKatalog,
  searchFrei,
  searchKgk,
  type FreiEntry,
  type Katalog,
  type KgkEntry,
} from '@/features/kostenermittlung/lib/katalog'
import { HAUPTGRUPPEN } from '@/features/kostenermittlung/lib/kgk'

export type KatalogPick =
  | { source: 'kgk'; entry: KgkEntry }
  | { source: 'frei'; entry: FreiEntry }

type Tab = 'kgk' | 'frei'

export function KatalogDialog({
  open,
  onOpenChange,
  onPick,
  hauptgruppe,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPick: (pick: KatalogPick) => void
  hauptgruppe?: number
}) {
  const [katalog, setKatalog] = useState<Katalog | null>(null)
  const [tab, setTab] = useState<Tab>('kgk')
  const [q, setQ] = useState('')
  const [filterHauptgruppe, setFilterHauptgruppe] = useState<number | undefined>(hauptgruppe)
  const [withPriceOnly, setWithPriceOnly] = useState(true)

  // Load catalog lazily when first opened. Keep the loader result once we have it.
  useEffect(() => {
    if (!open || katalog) return
    let cancelled = false
    void loadKatalog().then((k) => {
      if (!cancelled) setKatalog(k)
    })
    return () => {
      cancelled = true
    }
  }, [open, katalog])

  // Follow the row's Hauptgruppe when the dialog is re-opened from a different row.
  useEffect(() => {
    if (open) setFilterHauptgruppe(hauptgruppe)
  }, [open, hauptgruppe])

  const results = useMemo(() => {
    if (!katalog) return { kgk: [] as KgkEntry[], frei: [] as FreiEntry[] }
    return {
      kgk: searchKgk(katalog, q, { withPriceOnly, hauptgruppe: filterHauptgruppe }),
      frei: searchFrei(katalog, q, { withPriceOnly }),
    }
  }, [katalog, q, withPriceOnly, filterHauptgruppe])

  const current: (KgkEntry | FreiEntry)[] = tab === 'kgk' ? results.kgk : results.frei

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[82vh] w-[92vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <Dialog.Title className="text-sm font-semibold">
                Katalog · Ril 808
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                {katalog ? (
                  <>
                    Preisstand {katalog.meta.quartal} · BKI-Faktor{' '}
                    {katalog.meta.faktor.toString().replace('.', ',')} ·{' '}
                    {katalog.meta.kgkCount.toLocaleString('de-DE')} KGK-Einträge ·{' '}
                    {katalog.meta.freiCount.toLocaleString('de-DE')} freie Einträge
                  </>
                ) : (
                  'Lade Katalog…'
                )}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Schließen">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex items-center gap-1 border-b bg-muted/30 px-4">
            <TabButton
              label={`Datenbank Ril 808${katalog ? ` · ${results.kgk.length}` : ''}`}
              active={tab === 'kgk'}
              onClick={() => setTab('kgk')}
            />
            <TabButton
              label={`Freie Einheitspreise${katalog ? ` · ${results.frei.length}` : ''}`}
              active={tab === 'frei'}
              onClick={() => setTab('frei')}
            />
            <div className="flex-1" />
            <label className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={withPriceOnly}
                onChange={(e) => setWithPriceOnly(e.target.checked)}
              />
              Nur mit Preis
            </label>
          </div>

          <div className="flex items-center gap-2 border-b px-4 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={
                tab === 'kgk'
                  ? 'KGK, Bezeichnung oder Pfad suchen …'
                  : 'Bezeichnung oder Anmerkung suchen …'
              }
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {tab === 'kgk' && (
              <select
                value={filterHauptgruppe ?? ''}
                onChange={(e) =>
                  setFilterHauptgruppe(e.target.value ? Number(e.target.value) : undefined)
                }
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Alle Hauptgruppen</option>
                {HAUPTGRUPPEN.map((h) => (
                  <option key={h.nummer} value={h.nummer}>
                    {h.nummer} · {h.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex min-h-0 flex-1">
            {tab === 'kgk' ? (
              <KgkList
                entries={results.kgk}
                onPick={(e) => {
                  onPick({ source: 'kgk', entry: e })
                  onOpenChange(false)
                }}
              />
            ) : (
              <FreiList
                entries={results.frei}
                onPick={(e) => {
                  onPick({ source: 'frei', entry: e })
                  onOpenChange(false)
                }}
              />
            )}
          </div>
          {!katalog && current.length === 0 && (
            <div className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
              Lade Katalog …
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function KgkList({
  entries,
  onPick,
}: {
  entries: KgkEntry[]
  onPick: (e: KgkEntry) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 54,
    overscan: 10,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-[110px_1fr_60px_80px_140px] gap-2 border-b bg-muted/50 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <div>KGK</div>
        <div>Bezeichnung</div>
        <div>Ebene</div>
        <div>Einheit</div>
        <div className="text-right">EP Q3/2026 [EUR]</div>
      </div>
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const e = entries[virtualRow.index]
            return (
              <div
                key={e.code + ':' + virtualRow.index}
                className="absolute left-0 top-0 w-full cursor-pointer border-b px-3 py-1.5 text-xs hover:bg-accent/40"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: virtualRow.size,
                }}
                onClick={() => onPick(e)}
              >
                <div className="grid grid-cols-[110px_1fr_60px_80px_140px] gap-2">
                  <div className="font-mono tabular-nums text-muted-foreground">
                    {e.code}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.bezeichnung}</div>
                    {e.pfad && (
                      <div className="truncate text-[10px] text-muted-foreground">
                        {e.pfad}
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground">{e.ebene}</div>
                  <div className="text-muted-foreground">{e.einheit ?? '—'}</div>
                  <div className="text-right font-mono tabular-nums">
                    {formatRange(e.epVon, e.epBis)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FreiList({
  entries,
  onPick,
}: {
  entries: FreiEntry[]
  onPick: (e: FreiEntry) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-[1fr_280px_80px_120px] gap-2 border-b bg-muted/50 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <div>Bezeichnung</div>
        <div>Anmerkung</div>
        <div>Einheit</div>
        <div className="text-right">Betrag Q3/2026 [EUR]</div>
      </div>
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const e = entries[virtualRow.index]
            return (
              <div
                key={e.id}
                className="absolute left-0 top-0 w-full cursor-pointer border-b px-3 py-1.5 text-xs hover:bg-accent/40"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: virtualRow.size,
                }}
                onClick={() => onPick(e)}
              >
                <div className="grid grid-cols-[1fr_280px_80px_120px] gap-2">
                  <div className="truncate font-medium">{e.bezeichnung}</div>
                  <div className="truncate text-muted-foreground">
                    {e.anmerkung ?? ''}
                  </div>
                  <div className="text-muted-foreground">{e.einheit ?? '—'}</div>
                  <div className="text-right font-mono tabular-nums">
                    {e.betrag !== null ? fmt2(e.betrag) : '—'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        '-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors',
        active
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

function fmt2(v: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

function formatRange(von: number | null, bis: number | null): string {
  if (von === null && bis === null) return '—'
  if (von !== null && bis !== null && von !== bis) {
    return `${fmt2(von)} – ${fmt2(bis)}`
  }
  return fmt2(von ?? bis ?? 0)
}

// Translate a picker selection into the patch applied to a Position.
export function pickToPatch(pick: KatalogPick): {
  kgk?: string | null
  text?: string
  einheit?: string
  einheitspreis?: number
  anmerkung?: string | null
} {
  if (pick.source === 'kgk') {
    const e = pick.entry
    return {
      kgk: e.code,
      text: e.bezeichnung,
      einheit: e.einheit ?? '',
      einheitspreis: defaultPrice(e),
      anmerkung: e.anmerkung ?? null,
    }
  }
  const e = pick.entry
  return {
    text: e.bezeichnung,
    einheit: e.einheit ?? '',
    einheitspreis: e.betrag ?? 0,
    anmerkung: e.anmerkung ?? null,
  }
}
