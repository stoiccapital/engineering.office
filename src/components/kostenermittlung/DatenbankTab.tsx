import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'
import {
  loadKatalog,
  searchFrei,
  searchKgk,
  type FreiEntry,
  type Katalog,
  type KgkEntry,
} from '@/features/kostenermittlung/lib/katalog'
import { HAUPTGRUPPEN } from '@/features/kostenermittlung/lib/kgk'

type Tab = 'kgk' | 'frei'

export function DatenbankTab() {
  const [katalog, setKatalog] = useState<Katalog | null>(null)
  const [tab, setTab] = useState<Tab>('kgk')
  const [q, setQ] = useState('')
  const [filterHauptgruppe, setFilterHauptgruppe] = useState<number | undefined>(undefined)
  const [withPriceOnly, setWithPriceOnly] = useState(false)

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
    if (!katalog) return { kgk: [] as KgkEntry[], frei: [] as FreiEntry[] }
    return {
      // Virtualized lists — no need to cap. Counts in the tab labels
      // reflect actual matches.
      kgk: searchKgk(
        katalog,
        q,
        { withPriceOnly, hauptgruppe: filterHauptgruppe },
        Number.POSITIVE_INFINITY,
      ),
      frei: searchFrei(katalog, q, { withPriceOnly }, Number.POSITIVE_INFINITY),
    }
  }, [katalog, q, withPriceOnly, filterHauptgruppe])

  return (
    <div className="space-y-4">
      <Section
        title="Datenbank Ril 808"
        subtitle={
          katalog
            ? `Preisstand ${katalog.meta.quartal} · BKI-Faktor ${katalog.meta.faktor
                .toString()
                .replace('.', ',')} · ${katalog.meta.quelle}`
            : 'Lade Katalog …'
        }
        padded={false}
      >
        <div className="grid grid-cols-4 gap-4 border-b px-4 py-3 text-sm">
          <Stat
            label="KGK-Einträge"
            value={katalog ? katalog.meta.kgkCount.toLocaleString('de-DE') : '—'}
            sub={
              katalog
                ? `${katalog.meta.kgkMitPreis.toLocaleString('de-DE')} mit Preis`
                : undefined
            }
          />
          <Stat
            label="Freie Einträge"
            value={katalog ? katalog.meta.freiCount.toLocaleString('de-DE') : '—'}
            sub={
              katalog
                ? `${katalog.meta.freiMitPreis.toLocaleString('de-DE')} mit Preis`
                : undefined
            }
          />
          <Stat
            label="Preisstand"
            value={katalog?.meta.quartal ?? '—'}
          />
          <Stat
            label="BKI-Faktor"
            value={
              katalog ? katalog.meta.faktor.toString().replace('.', ',') : '—'
            }
          />
        </div>

        <div className="flex items-center gap-1 border-b bg-muted/30 px-3">
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
                setFilterHauptgruppe(
                  e.target.value ? Number(e.target.value) : undefined,
                )
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

        {tab === 'kgk' ? (
          <KgkList entries={results.kgk} />
        ) : (
          <FreiList entries={results.frei} />
        )}
      </Section>
    </div>
  )
}

function KgkList({ entries }: { entries: KgkEntry[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virt = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 54,
    overscan: 10,
  })

  return (
    <>
      <div className="grid grid-cols-[110px_280px_1fr_60px_80px_180px] gap-2 border-b bg-muted/50 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <div>KGK</div>
        <div>Bezeichnung</div>
        <div>Anmerkung</div>
        <div>Ebene</div>
        <div>Einheit</div>
        <div className="text-right">EP Q3/2026 [EUR]</div>
      </div>
      <div ref={parentRef} className="h-[60vh] overflow-y-auto">
        <div
          style={{
            height: virt.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {virt.getVirtualItems().map((row) => {
            const e = entries[row.index]
            return (
              <div
                key={e.code + ':' + row.index}
                className="absolute left-0 top-0 w-full border-b px-4 py-1.5 text-xs"
                style={{
                  transform: `translateY(${row.start}px)`,
                  height: row.size,
                }}
              >
                <div className="grid grid-cols-[110px_280px_1fr_60px_80px_180px] gap-2">
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
                  <div
                    className="truncate text-muted-foreground"
                    title={e.anmerkung ?? undefined}
                  >
                    {e.anmerkung ?? ''}
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
          {entries.length === 0 && (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              Keine Ergebnisse.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function FreiList({ entries }: { entries: FreiEntry[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virt = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  return (
    <>
      <div className="grid grid-cols-[1fr_320px_80px_140px] gap-2 border-b bg-muted/50 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <div>Bezeichnung</div>
        <div>Anmerkung</div>
        <div>Einheit</div>
        <div className="text-right">Betrag Q3/2026 [EUR]</div>
      </div>
      <div ref={parentRef} className="h-[60vh] overflow-y-auto">
        <div
          style={{
            height: virt.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {virt.getVirtualItems().map((row) => {
            const e = entries[row.index]
            return (
              <div
                key={e.id}
                className="absolute left-0 top-0 w-full border-b px-4 py-1.5 text-xs"
                style={{
                  transform: `translateY(${row.start}px)`,
                  height: row.size,
                }}
              >
                <div className="grid grid-cols-[1fr_320px_80px_140px] gap-2">
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
          {entries.length === 0 && (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              Keine Ergebnisse.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono tabular-nums text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
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
