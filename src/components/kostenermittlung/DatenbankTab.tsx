import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Eye, EyeOff, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
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
import {
  mergeKatalog,
  nextAddedFreiId,
} from '@/features/kostenermittlung/lib/katalogOverrides'
import { useKatalogOverrides } from '@/katalog-overrides-store'
import { EntryEditor, type EntryEditorTarget } from './EntryEditor'

type Tab = 'kgk' | 'frei'

export function DatenbankTab() {
  const [baseKatalog, setBaseKatalog] = useState<Katalog | null>(null)
  const overrides = useKatalogOverrides((s) => s.overrides)
  const loadOverrides = useKatalogOverrides((s) => s.load)
  const updateKgk = useKatalogOverrides((s) => s.updateKgk)
  const addKgk = useKatalogOverrides((s) => s.addKgk)
  const removeKgk = useKatalogOverrides((s) => s.removeKgk)
  const hideKgk = useKatalogOverrides((s) => s.hideKgk)
  const showKgk = useKatalogOverrides((s) => s.showKgk)
  const updateFrei = useKatalogOverrides((s) => s.updateFrei)
  const addFrei = useKatalogOverrides((s) => s.addFrei)
  const removeFrei = useKatalogOverrides((s) => s.removeFrei)
  const hideFrei = useKatalogOverrides((s) => s.hideFrei)
  const showFrei = useKatalogOverrides((s) => s.showFrei)
  const resetOverrides = useKatalogOverrides((s) => s.reset)

  const [tab, setTab] = useState<Tab>('kgk')
  const [q, setQ] = useState('')
  const [filterHauptgruppe, setFilterHauptgruppe] = useState<number | undefined>(undefined)
  const [withPriceOnly, setWithPriceOnly] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [editorTarget, setEditorTarget] = useState<EntryEditorTarget | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadKatalog().then((k) => {
      if (!cancelled) setBaseKatalog(k)
    })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    if (!overrides) void loadOverrides()
  }, [overrides, loadOverrides])

  // Merge base + overrides. When "Ausgeblendete einblenden" is on, we show
  // hidden rows too (so the user can un-hide them).
  const katalog = useMemo(() => {
    if (!baseKatalog) return null
    const o = overrides
    if (!o) return baseKatalog
    if (showHidden) {
      // Merge with hidden lists emptied so hidden rows reappear.
      return mergeKatalog(baseKatalog, { ...o, kgkHidden: [], freiHidden: [] })
    }
    return mergeKatalog(baseKatalog, o)
  }, [baseKatalog, overrides, showHidden])

  const hiddenKgk = useMemo(
    () => new Set(overrides?.kgkHidden ?? []),
    [overrides?.kgkHidden],
  )
  const hiddenFrei = useMemo(
    () => new Set(overrides?.freiHidden ?? []),
    [overrides?.freiHidden],
  )
  const addedKgkCodes = useMemo(
    () => new Set((overrides?.kgkAdded ?? []).map((e) => e.code)),
    [overrides?.kgkAdded],
  )
  const addedFreiIds = useMemo(
    () => new Set((overrides?.freiAdded ?? []).map((e) => e.id)),
    [overrides?.freiAdded],
  )

  const results = useMemo(() => {
    if (!katalog) return { kgk: [] as KgkEntry[], frei: [] as FreiEntry[] }
    return {
      kgk: searchKgk(
        katalog,
        q,
        { withPriceOnly, hauptgruppe: filterHauptgruppe },
        Number.POSITIVE_INFINITY,
      ),
      frei: searchFrei(katalog, q, { withPriceOnly }, Number.POSITIVE_INFINITY),
    }
  }, [katalog, q, withPriceOnly, filterHauptgruppe])

  const overridesCount =
    (overrides?.kgkAdded.length ?? 0) +
    (overrides?.freiAdded.length ?? 0) +
    Object.keys(overrides?.kgkUpdates ?? {}).length +
    Object.keys(overrides?.freiUpdates ?? {}).length +
    (overrides?.kgkHidden.length ?? 0) +
    (overrides?.freiHidden.length ?? 0)

  const openRow = (entry: KgkEntry | FreiEntry) => {
    if (!editMode) return
    if ('code' in entry) {
      setEditorTarget({
        kind: 'editKgk',
        entry,
        isAdded: addedKgkCodes.has(entry.code),
      })
    } else {
      setEditorTarget({
        kind: 'editFrei',
        entry,
        isAdded: addedFreiIds.has(entry.id),
      })
    }
  }

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
        action={
          <div className="flex items-center gap-2">
            {editMode && overridesCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm('Alle Ergänzungen zurücksetzen?')) resetOverrides()
                }}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Zurücksetzen
              </Button>
            )}
            <Button
              variant={editMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditMode((v) => !v)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {editMode ? 'Fertig' : 'Bearbeiten'}
            </Button>
          </div>
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
          <Stat label="Preisstand" value={katalog?.meta.quartal ?? '—'} />
          <Stat
            label="Eigene Ergänzungen"
            value={overridesCount.toString()}
            sub={
              overridesCount > 0
                ? `${(overrides?.kgkAdded.length ?? 0) + (overrides?.freiAdded.length ?? 0)} neu, ${(overrides?.kgkHidden.length ?? 0) + (overrides?.freiHidden.length ?? 0)} ausgeblendet`
                : undefined
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
          {editMode && (
            <label className="ml-3 flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
              />
              Ausgeblendete einblenden
            </label>
          )}
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
          {editMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setEditorTarget(tab === 'kgk' ? { kind: 'addKgk' } : { kind: 'addFrei' })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {tab === 'kgk' ? 'KGK' : 'Eintrag'}
            </Button>
          )}
        </div>

        {tab === 'kgk' ? (
          <KgkList
            entries={results.kgk}
            editMode={editMode}
            hiddenKgk={hiddenKgk}
            addedKgkCodes={addedKgkCodes}
            onRowClick={openRow}
            onToggleHide={(code) =>
              hiddenKgk.has(code) ? showKgk(code) : hideKgk(code)
            }
            onDelete={(code) => removeKgk(code)}
          />
        ) : (
          <FreiList
            entries={results.frei}
            editMode={editMode}
            hiddenFrei={hiddenFrei}
            addedFreiIds={addedFreiIds}
            onRowClick={openRow}
            onToggleHide={(id) =>
              hiddenFrei.has(id) ? showFrei(id) : hideFrei(id)
            }
            onDelete={(id) => removeFrei(id)}
          />
        )}
      </Section>

      <EntryEditor
        target={editorTarget}
        katalog={baseKatalog}
        overrides={overrides}
        onClose={() => setEditorTarget(null)}
        onSaveKgk={(entry, mode) => {
          if (mode === 'add') addKgk(entry)
          else {
            const { code, bezeichnung, anmerkung, einheit, epVon, epBis, epEinheit } = entry
            updateKgk(code, { bezeichnung, anmerkung, einheit, epVon, epBis, epEinheit })
          }
        }}
        onSaveFrei={(entry, mode) => {
          if (mode === 'add') {
            const id = nextAddedFreiId(overrides?.freiAdded ?? [])
            addFrei({ ...entry, id })
          } else {
            const { id, bezeichnung, anmerkung, betrag, einheit } = entry
            updateFrei(id, { bezeichnung, anmerkung, betrag, einheit })
          }
        }}
        onDelete={() => {
          if (editorTarget?.kind === 'editKgk') removeKgk(editorTarget.entry.code)
          if (editorTarget?.kind === 'editFrei') removeFrei(editorTarget.entry.id)
        }}
        onHide={() => {
          if (editorTarget?.kind === 'editKgk') hideKgk(editorTarget.entry.code)
          if (editorTarget?.kind === 'editFrei') hideFrei(editorTarget.entry.id)
        }}
      />
    </div>
  )
}

function KgkList({
  entries,
  editMode,
  hiddenKgk,
  addedKgkCodes,
  onRowClick,
  onToggleHide,
  onDelete,
}: {
  entries: KgkEntry[]
  editMode: boolean
  hiddenKgk: Set<string>
  addedKgkCodes: Set<string>
  onRowClick: (e: KgkEntry) => void
  onToggleHide: (code: string) => void
  onDelete: (code: string) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virt = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 54,
    overscan: 10,
  })

  // All 22 columns from the Excel source + leading Aktion-Spalte when in edit
  // mode. Dynamic grid templates go via inline style — Tailwind's JIT won't
  // pick up computed class names.
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns:
      (editMode ? '60px ' : '') +
      '110px 60px 240px 80px 260px 320px 120px 120px 140px 160px 180px 180px 180px 180px 180px 80px 120px 120px 120px 120px 120px 120px',
    gap: '0.5rem',
    alignItems: 'center',
  }

  // 22 column widths + 8 px grid-gap × 21 + horizontal row padding (px-4 = 32 px).
  // Inner wrapper must be at least this wide so row border-b extends across
  // the whole table, not just the viewport.
  const innerMinWidth = (editMode ? 60 + 8 : 0) + 3310 + 21 * 8 + 32

  return (
    <div ref={parentRef} className="h-[60vh] overflow-auto">
      <div style={{ minWidth: innerMinWidth }}>
        <div
          style={gridStyle}
          className="sticky top-0 z-10 border-b bg-muted/80 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground backdrop-blur"
        >
          {editMode && <div></div>}
          <div>KGK</div>
          <div>Ebene</div>
          <div>Bezeichnung</div>
          <div>Einheit</div>
          <div>Anmerkung</div>
          <div>Pfad</div>
          <div>Code i. Quelle</div>
          <div>Übergeordnet</div>
          <div>Kostengliederung</div>
          <div>Ebene 1</div>
          <div>Ebene 2</div>
          <div>Ebene 3</div>
          <div>Ebene 4</div>
          <div>Ebene 5</div>
          <div>Ebene 6</div>
          <div className="text-right">Faktor</div>
          <div className="text-right">EP Q3/26 von</div>
          <div className="text-right">EP Q3/26 bis</div>
          <div>Einh.-Spanne</div>
          <div className="text-right">EP AKT. von</div>
          <div className="text-right">EP AKT. bis</div>
          <div>Einh.-AKT.</div>
        </div>
        <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
          {virt.getVirtualItems().map((row) => {
            const e = entries[row.index]
            const hidden = hiddenKgk.has(e.code)
            const added = addedKgkCodes.has(e.code)
            return (
              <div
                key={e.code + ':' + row.index}
                onClick={() => onRowClick(e)}
                className={cn(
                  'group absolute left-0 top-0 w-full border-b px-4 py-1.5 text-xs',
                  editMode && 'cursor-pointer hover:bg-accent/40',
                  hidden && 'opacity-50',
                )}
                style={{
                  transform: `translateY(${row.start}px)`,
                  height: row.size,
                }}
              >
                <div style={gridStyle}>
                  {editMode && (
                    <div className="flex items-center gap-0.5">
                      {added ? (
                        <button
                          type="button"
                          title="Löschen"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            if (window.confirm(`"${e.bezeichnung}" löschen?`))
                              onDelete(e.code)
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title={hidden ? 'Wieder einblenden' : 'Ausblenden'}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            onToggleHide(e.code)
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-accent"
                        >
                          {hidden ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  <Cell className="flex items-center gap-1 font-mono tabular-nums text-muted-foreground">
                    {e.code}
                    {added && (
                      <span
                        title="Benutzer-Eintrag"
                        className="inline-flex items-center rounded-sm bg-emerald-500/15 px-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                      >
                        neu
                      </span>
                    )}
                  </Cell>
                  <Cell className="text-muted-foreground">{e.ebene}</Cell>
                  <Cell className="truncate font-medium" title={e.bezeichnung}>
                    {e.bezeichnung}
                  </Cell>
                  <Cell className="text-muted-foreground">{e.einheit ?? '—'}</Cell>
                  <Cell className="truncate text-muted-foreground" title={e.anmerkung ?? undefined}>
                    {e.anmerkung ?? ''}
                  </Cell>
                  <Cell className="truncate text-muted-foreground" title={e.pfad ?? undefined}>
                    {e.pfad ?? ''}
                  </Cell>
                  <Cell className="font-mono tabular-nums text-muted-foreground">
                    {e.codeInQuelle ?? ''}
                  </Cell>
                  <Cell className="font-mono tabular-nums text-muted-foreground">
                    {e.parent ?? ''}
                  </Cell>
                  <Cell className="font-mono tabular-nums text-muted-foreground">
                    {e.kostengliederung ?? ''}
                  </Cell>
                  <Cell className="truncate text-muted-foreground" title={e.ebene1 ?? undefined}>
                    {e.ebene1 ?? ''}
                  </Cell>
                  <Cell className="truncate text-muted-foreground" title={e.ebene2 ?? undefined}>
                    {e.ebene2 ?? ''}
                  </Cell>
                  <Cell className="truncate text-muted-foreground" title={e.ebene3 ?? undefined}>
                    {e.ebene3 ?? ''}
                  </Cell>
                  <Cell className="truncate text-muted-foreground" title={e.ebene4 ?? undefined}>
                    {e.ebene4 ?? ''}
                  </Cell>
                  <Cell className="truncate text-muted-foreground" title={e.ebene5 ?? undefined}>
                    {e.ebene5 ?? ''}
                  </Cell>
                  <Cell className="truncate text-muted-foreground" title={e.ebene6 ?? undefined}>
                    {e.ebene6 ?? ''}
                  </Cell>
                  <Cell className="text-right font-mono tabular-nums text-muted-foreground">
                    {formatNum(e.faktor)}
                  </Cell>
                  <Cell className="text-right font-mono tabular-nums">{formatNum(e.epVon)}</Cell>
                  <Cell className="text-right font-mono tabular-nums">{formatNum(e.epBis)}</Cell>
                  <Cell className="text-muted-foreground">{e.epEinheit ?? ''}</Cell>
                  <Cell className="text-right font-mono tabular-nums">
                    {formatNum(e.epAktuellVon)}
                  </Cell>
                  <Cell className="text-right font-mono tabular-nums">
                    {formatNum(e.epAktuellBis)}
                  </Cell>
                  <Cell className="text-muted-foreground">{e.epAktuellEinheit ?? ''}</Cell>
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
    </div>
  )
}

function Cell({
  className,
  title,
  children,
}: {
  className?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('min-w-0', className)} title={title}>
      {children}
    </div>
  )
}

function formatNum(v: number | null): string {
  if (v === null || v === undefined) return ''
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

function FreiList({
  entries,
  editMode,
  hiddenFrei,
  addedFreiIds,
  onRowClick,
  onToggleHide,
  onDelete,
}: {
  entries: FreiEntry[]
  editMode: boolean
  hiddenFrei: Set<number>
  addedFreiIds: Set<number>
  onRowClick: (e: FreiEntry) => void
  onToggleHide: (id: number) => void
  onDelete: (id: number) => void
}) {
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
        <div style={{ height: virt.getTotalSize(), position: 'relative', width: '100%' }}>
          {virt.getVirtualItems().map((row) => {
            const e = entries[row.index]
            const hidden = hiddenFrei.has(e.id)
            const added = addedFreiIds.has(e.id)
            return (
              <div
                key={e.id}
                onClick={() => onRowClick(e)}
                className={cn(
                  'group absolute left-0 top-0 w-full border-b px-4 py-1.5 text-xs',
                  editMode && 'cursor-pointer hover:bg-accent/40',
                  hidden && 'opacity-50',
                )}
                style={{
                  transform: `translateY(${row.start}px)`,
                  height: row.size,
                }}
              >
                <div className="grid grid-cols-[1fr_320px_80px_140px] gap-2">
                  <div className="flex items-center gap-1">
                    <div className="truncate font-medium">{e.bezeichnung}</div>
                    {added && (
                      <span
                        title="Benutzer-Eintrag"
                        className="inline-flex items-center rounded-sm bg-emerald-500/15 px-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                      >
                        neu
                      </span>
                    )}
                  </div>
                  <div className="truncate text-muted-foreground">
                    {e.anmerkung ?? ''}
                  </div>
                  <div className="text-muted-foreground">{e.einheit ?? '—'}</div>
                  <div className="flex items-center justify-end gap-2">
                    <div className="text-right font-mono tabular-nums">
                      {e.betrag !== null ? fmt2(e.betrag) : '—'}
                    </div>
                    {editMode &&
                      (added ? (
                        <button
                          type="button"
                          title="Löschen"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            if (window.confirm(`"${e.bezeichnung}" löschen?`))
                              onDelete(e.id)
                          }}
                          className="rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title={hidden ? 'Wieder einblenden' : 'Ausblenden'}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            onToggleHide(e.id)
                          }}
                          className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
                        >
                          {hidden ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ))}
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

