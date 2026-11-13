import { memo, useCallback, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { LoadingCard } from '@/components/ui/loading-card'
import {
  totalSums,
  useProjektliste,
  visibleRows,
  type ImportMode,
  type ProjektlisteSort,
  type ProjektlisteSortCol,
} from '@/projektliste-store'
import { logActivity } from '@/activity-store'
import {
  PROJEKTLISTE_STATUS_PRESETS,
  type ForecastFlag,
  type ProjektlisteRow,
} from '@/types'
import { fmtEUR } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_CHIP: Record<string, string> = {
  'in Bearbeitung':
    'bg-amber-100 text-amber-900 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200',
  'Projekt ruht':
    'bg-sky-100 text-sky-900 border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200',
  'Projekt beendet':
    'bg-emerald-100 text-emerald-900 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200',
  'Projekt abgeschlossen':
    'bg-emerald-100 text-emerald-900 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200',
}

export function Projektliste() {
  const doc = useProjektliste((s) => s.doc)
  const status = useProjektliste((s) => s.status)
  const search = useProjektliste((s) => s.search)
  const setSearch = useProjektliste((s) => s.setSearch)
  const statusFilter = useProjektliste((s) => s.statusFilter)
  const setStatusFilter = useProjektliste((s) => s.setStatusFilter)
  const sort = useProjektliste((s) => s.sort)
  const setSort = useProjektliste((s) => s.setSort)
  const addRow = useProjektliste((s) => s.addRow)
  const updateRow = useProjektliste((s) => s.updateRow)
  const removeRow = useProjektliste((s) => s.removeRow)
  const stageImport = useProjektliste((s) => s.stageImport)
  const setStagedMode = useProjektliste((s) => s.setStagedMode)
  const cancelStagedImport = useProjektliste((s) => s.cancelStagedImport)
  const commitStagedImport = useProjektliste((s) => s.commitStagedImport)
  const undoLastImport = useProjektliste((s) => s.undoLastImport)
  const stagedImport = useProjektliste((s) => s.stagedImport)
  const lastImportBackup = useProjektliste((s) => s.lastImportBackup)

  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const shown = useMemo(() => {
    if (!doc) return []
    return visibleRows(doc, search, statusFilter, sort)
  }, [doc, search, statusFilter, sort])

  const statusOptions = useMemo(() => {
    if (!doc) return []
    const seen = new Set<string>()
    for (const r of doc.rows) if (r.status) seen.add(r.status)
    return Array.from(seen).sort()
  }, [doc])

  // Stable callbacks per row so React.memo on Row actually prevents
  // re-renders during unrelated edits.
  const onUpdateRow = useCallback(
    (id: string, patch: Partial<ProjektlisteRow>) => updateRow(id, patch),
    [updateRow],
  )
  const onRemoveRow = useCallback((id: string) => removeRow(id), [removeRow])

  if (!doc && status === 'loading') return <LoadingCard>Lade Projektliste…</LoadingCard>
  if (!doc) return <LoadingCard>Lade Projektliste…</LoadingCard>

  const totals = totalSums(doc.rows)
  const shownTotals = totalSums(shown)
  const filtered = shown.length !== doc.rows.length

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const rows = parseWorkbook(wb)
      if (rows.length === 0) {
        setImportError('Keine Zeilen im Blatt "Ausdruck" gefunden.')
        return
      }
      stageImport(rows, 'merge')
    } catch (err) {
      setImportError((err as Error).message || 'Import fehlgeschlagen.')
    }
  }

  return (
    <div className="space-y-4">
      <Section
        title="Projektliste"
        subtitle={
          filtered
            ? `${shown.length} von ${doc.rows.length} Projekten · Filter aktiv${doc.importedAt ? ` · Import ${new Date(doc.importedAt).toLocaleDateString('de-DE')}` : ''}`
            : `${doc.rows.length} ${doc.rows.length === 1 ? 'Projekt' : 'Projekte'}${doc.importedAt ? ` · Import ${new Date(doc.importedAt).toLocaleDateString('de-DE')}` : ''}`
        }
        padded={false}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche Projekt, PL, Status …"
                className="h-8 w-56 rounded-md border border-input bg-background pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Alle Status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 h-3.5 w-3.5" /> Import Excel
            </Button>
            <Button size="sm" onClick={() => addRow()}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Zeile
            </Button>
          </div>
        }
      >
        {/* Portfolio summary band — always shows shown vs total */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b bg-muted/30 px-4 py-2 text-xs">
          <SummaryStat
            label="Projekte"
            shown={shownTotals.count}
            total={totals.count}
            filtered={filtered}
            numeric={false}
          />
          <SummaryStat
            label="Kosten"
            shown={shownTotals.kosten}
            total={totals.kosten}
            filtered={filtered}
          />
          <SummaryStat
            label="Gewinn / Verlust"
            shown={shownTotals.gewinn}
            total={totals.gewinn}
            filtered={filtered}
            colorByValue
          />
          <SummaryStat
            label="Forecast"
            shown={shownTotals.forecast}
            total={totals.forecast}
            filtered={filtered}
          />
          <SummaryStat
            label="Abgerechnet"
            shown={shownTotals.abgerechnet}
            total={totals.abgerechnet}
            filtered={filtered}
          />
        </div>

        {importError && (
          <div className="border-b px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{importError}</span>
              <button
                onClick={() => setImportError(null)}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1800px] border-collapse text-[13px]">
            <thead className="bg-muted/60">
              <tr className="border-b text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <SortHeader
                  col="projekt"
                  label="Projekt"
                  sort={sort}
                  onSort={setSort}
                  className="sticky left-0 z-10 w-72 bg-muted/60"
                />
                <th className="w-16 px-2 py-2 text-left">NL</th>
                <SortHeader
                  col="projektleiter"
                  label="Projektleiter"
                  sort={sort}
                  onSort={setSort}
                  className="w-32"
                />
                <SortHeader
                  col="status"
                  label="Status"
                  sort={sort}
                  onSort={setSort}
                  className="w-36"
                />
                <SortHeader
                  col="abrechnungsstandEur"
                  label="Abrechn.-Stand"
                  sort={sort}
                  onSort={setSort}
                  className="w-32"
                  align="right"
                />
                <th className="w-28 px-2 py-2 text-right">Personalk.</th>
                <th className="w-28 px-2 py-2 text-right">direkte K.</th>
                <SortHeader
                  col="kostensumme"
                  label="Kostensumme"
                  sort={sort}
                  onSort={setSort}
                  className="w-28"
                  align="right"
                />
                <SortHeader
                  col="gewinnVerlust"
                  label="G / V"
                  sort={sort}
                  onSort={setSort}
                  className="w-28"
                  align="right"
                />
                <th className="px-2 py-2 text-left">Leistung</th>
                <SortHeader
                  col="forecastGesamt"
                  label="Forecast Σ"
                  sort={sort}
                  onSort={setSort}
                  className="w-32"
                  align="right"
                />
                <th className="w-28 px-2 py-2 text-right">Forecast PL</th>
                <th className="w-28 px-2 py-2 text-right">Forecast DE</th>
                <SortHeader
                  col="abgerechnetGesamt"
                  label="Abger. Σ"
                  sort={sort}
                  onSort={setSort}
                  className="w-28"
                  align="right"
                />
                <th className="w-28 px-2 py-2 text-right">Abger. PL</th>
                <th className="w-28 px-2 py-2 text-right">Abger. DE</th>
                <th className="w-28 px-2 py-2 text-right">Offen DE</th>
                <th className="w-28 px-2 py-2 text-right">Offen PL</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={19} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    {doc.rows.length === 0 ? (
                      <>
                        Noch keine Projektliste geladen. Klick auf „Import Excel".
                      </>
                    ) : (
                      <>
                        Keine Treffer mit dem aktuellen Filter.
                        <button
                          onClick={() => {
                            setSearch('')
                            setStatusFilter('')
                          }}
                          className="ml-2 text-foreground underline underline-offset-2"
                        >
                          Filter zurücksetzen
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                shown.map((r) => (
                  <Row
                    key={r.id}
                    row={r}
                    onUpdate={onUpdateRow}
                    onRemove={onRemoveRow}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <ImportPreviewDialog
        preview={stagedImport}
        onCancel={() => cancelStagedImport()}
        onModeChange={setStagedMode}
        onConfirm={() => {
          const res = commitStagedImport()
          logActivity({
            kind: 'action',
            action: 'projektliste.import',
            target: `${res.added} neu · ${res.updated} aktualisiert`,
          })
        }}
      />

      {lastImportBackup && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-lg">
            <span className="text-sm">
              <strong className="font-semibold">Import angewendet.</strong>{' '}
              <span className="text-muted-foreground">
                Rückgängig für 15 Sekunden möglich.
              </span>
            </span>
            <Button variant="ghost" size="sm" onClick={undoLastImport}>
              <Undo2 className="mr-1 h-3.5 w-3.5" />
              Rückgängig
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryStat({
  label,
  shown,
  total,
  filtered,
  colorByValue,
  numeric = true,
}: {
  label: string
  shown: number
  total: number
  filtered: boolean
  colorByValue?: boolean
  numeric?: boolean
}) {
  const fmt = (v: number) => (numeric ? fmtEUR(v) : String(v))
  const tone =
    colorByValue && shown < 0
      ? 'text-destructive'
      : colorByValue && shown > 0
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-foreground'
  return (
    <div className="inline-flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn('font-mono text-sm font-semibold tabular-nums', tone)}>
        {fmt(shown)}
      </span>
      {filtered && (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          / {fmt(total)}
        </span>
      )}
    </div>
  )
}

function SortHeader({
  col,
  label,
  sort,
  onSort,
  className,
  align,
}: {
  col: ProjektlisteSortCol
  label: string
  sort: ProjektlisteSort
  onSort: (s: ProjektlisteSort) => void
  className?: string
  align?: 'right'
}) {
  const active = sort.col === col
  const dir = active ? sort.dir : 'asc'
  const toggle = () => {
    if (!active) onSort({ col, dir: 'asc' })
    else onSort({ col, dir: dir === 'asc' ? 'desc' : 'asc' })
  }
  return (
    <th className={cn('px-2 py-2', align === 'right' ? 'text-right' : 'text-left', className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          align === 'right' && 'flex-row-reverse',
          active && 'text-foreground',
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : null}
      </button>
    </th>
  )
}

// Row — memoized so typing in one cell doesn't re-render the other 314 rows.
const Row = memo(function Row({
  row,
  onUpdate,
  onRemove,
}: {
  row: ProjektlisteRow
  onUpdate: (id: string, patch: Partial<ProjektlisteRow>) => void
  onRemove: (id: string) => void
}) {
  const nlLabel = nlOf(row.fachbereich)
  const gv = row.gewinnVerlust ?? 0
  return (
    <tr className="group border-b last:border-b-0 align-middle hover:bg-accent/30">
      <td className="sticky left-0 z-10 bg-background px-3 py-1 group-hover:bg-accent/30">
        <TextCell value={row.projekt} onChange={(v) => onUpdate(row.id, { projekt: v })} placeholder="Projektname" bold />
      </td>
      <td className="px-2 py-1">
        <span
          className={cn(
            'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase',
            nlLabel === 'DE' && 'border-sky-500/30 bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200',
            nlLabel === 'PL' && 'border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200',
            !nlLabel && 'border-border bg-muted text-muted-foreground',
          )}
          title={row.fachbereich}
        >
          {nlLabel || '?'}
        </span>
      </td>
      <td className="px-2 py-1">
        <TextCell value={row.projektleiter} onChange={(v) => onUpdate(row.id, { projektleiter: v })} placeholder="PL" />
      </td>
      <td className="px-2 py-1">
        <select
          value={row.status}
          onChange={(e) => onUpdate(row.id, { status: e.target.value })}
          className={cn(
            'h-6 w-full rounded border px-1.5 text-[11px] font-medium',
            STATUS_CHIP[row.status] ?? 'border-border bg-background text-muted-foreground',
          )}
        >
          <option value="">—</option>
          {PROJEKTLISTE_STATUS_PRESETS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {row.status && !PROJEKTLISTE_STATUS_PRESETS.includes(row.status as typeof PROJEKTLISTE_STATUS_PRESETS[number]) && (
            <option value={row.status}>{row.status}</option>
          )}
        </select>
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.abrechnungsstandEur} onChange={(v) => onUpdate(row.id, { abrechnungsstandEur: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.personalkosten} onChange={(v) => onUpdate(row.id, { personalkosten: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.direkteKosten} onChange={(v) => onUpdate(row.id, { direkteKosten: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.kostensumme} onChange={(v) => onUpdate(row.id, { kostensumme: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell
          value={row.gewinnVerlust}
          onChange={(v) => onUpdate(row.id, { gewinnVerlust: v })}
          className={cn(
            gv < 0 && 'text-destructive',
            gv > 0 && 'text-emerald-700 dark:text-emerald-300',
          )}
        />
      </td>
      <td className="px-2 py-1">
        <TextCell value={row.leistung} onChange={(v) => onUpdate(row.id, { leistung: v })} placeholder="Leistung in Worten" />
      </td>
      <td className="px-2 py-1">
        <NumFlagCell
          value={row.forecastGesamt}
          flag={row.forecastGesamtFlag}
          onChangeValue={(v) => onUpdate(row.id, { forecastGesamt: v })}
          onChangeFlag={(f) => onUpdate(row.id, { forecastGesamtFlag: f })}
        />
      </td>
      <td className="px-2 py-1">
        <NumFlagCell
          value={row.forecastPl}
          flag={row.forecastPlFlag}
          onChangeValue={(v) => onUpdate(row.id, { forecastPl: v })}
          onChangeFlag={(f) => onUpdate(row.id, { forecastPlFlag: f })}
        />
      </td>
      <td className="px-2 py-1">
        <NumFlagCell
          value={row.forecastDe}
          flag={row.forecastDeFlag}
          onChangeValue={(v) => onUpdate(row.id, { forecastDe: v })}
          onChangeFlag={(f) => onUpdate(row.id, { forecastDeFlag: f })}
        />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.abgerechnetGesamt} onChange={(v) => onUpdate(row.id, { abgerechnetGesamt: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.abgerechnetPl} onChange={(v) => onUpdate(row.id, { abgerechnetPl: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.abgerechnetDe} onChange={(v) => onUpdate(row.id, { abgerechnetDe: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.offenerForecastDe} onChange={(v) => onUpdate(row.id, { offenerForecastDe: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.offenerForecastPl} onChange={(v) => onUpdate(row.id, { offenerForecastPl: v })} />
      </td>
      <td className="px-1 py-1 text-right">
        <button
          onClick={() => onRemove(row.id)}
          className="rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label="Zeile löschen"
          title="Löschen"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  )
})

function TextCell({
  value,
  onChange,
  placeholder,
  bold,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  bold?: boolean
}) {
  // Keep text edits local during focus so the Zustand store (and every
  // other row) doesn't re-render on every keystroke. Commit on blur.
  const [text, setText] = useState(value)
  const [focused, setFocused] = useState(false)
  if (!focused && text !== value) setText(value)
  return (
    <input
      value={focused ? text : value}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => {
        setFocused(true)
        setText(value)
      }}
      onBlur={() => {
        setFocused(false)
        if (text !== value) onChange(text)
      }}
      placeholder={placeholder}
      className={cn(
        'w-full rounded bg-transparent px-1.5 py-0.5 text-[13px] outline-none focus:bg-background',
        bold && 'font-medium',
      )}
    />
  )
}

function NumCell({
  value,
  onChange,
  className,
}: {
  value: number | null
  onChange: (v: number | null) => void
  className?: string
}) {
  const [text, setText] = useState(fmtNum(value))
  const [focused, setFocused] = useState(false)
  if (!focused && text !== fmtNum(value)) setText(fmtNum(value))
  return (
    <input
      value={focused ? text : fmtNum(value)}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => {
        setFocused(true)
        setText(value === null ? '' : String(value).replace('.', ','))
      }}
      onBlur={() => {
        setFocused(false)
        const n = parseGermanNum(text)
        if (n !== value) onChange(n)
        setText(fmtNum(n))
      }}
      className={cn(
        'w-full rounded bg-transparent px-1.5 py-0.5 text-right font-mono text-[13px] tabular-nums outline-none focus:bg-background',
        className,
      )}
    />
  )
}

function NumFlagCell({
  value,
  flag,
  onChangeValue,
  onChangeFlag,
}: {
  value: number | null
  flag: ForecastFlag
  onChangeValue: (v: number | null) => void
  onChangeFlag: (f: ForecastFlag) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <NumCell value={value} onChange={onChangeValue} />
      <select
        value={flag ?? ''}
        onChange={(e) => {
          const v = e.target.value
          onChangeFlag(v === 'k' || v === 'w' ? v : null)
        }}
        className="h-5 w-10 rounded border border-input bg-background text-[10px]"
        title="k = kritisch, w = wahrscheinlich"
      >
        <option value="">—</option>
        <option value="w">w</option>
        <option value="k">k</option>
      </select>
    </div>
  )
}

function ImportPreviewDialog({
  preview,
  onCancel,
  onModeChange,
  onConfirm,
}: {
  preview: ReturnType<typeof useProjektliste.getState>['stagedImport']
  onCancel: () => void
  onModeChange: (m: ImportMode) => void
  onConfirm: () => void
}) {
  return (
    <Dialog.Root open={!!preview} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-5 shadow-xl">
          <Dialog.Title className="text-base font-semibold">
            Import vorbereitet
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Prüfe die Diff-Vorschau und bestätige, um den Import anzuwenden.
          </Dialog.Description>
          {preview && (
            <>
              <div className="mt-4 space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Neue Projekte</span>
                  <span className="font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                    + {preview.added}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Aktualisiert</span>
                  <span className="font-mono font-semibold tabular-nums">
                    ~ {preview.updated}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">
                    Nicht in der Datei vorhanden
                  </span>
                  <span
                    className={cn(
                      'font-mono font-semibold tabular-nums',
                      preview.mode === 'replace'
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                    )}
                  >
                    {preview.mode === 'replace' ? '− ' : ''}
                    {preview.keptOrRemoved}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({preview.mode === 'replace' ? 'werden gelöscht' : 'bleiben erhalten'})
                    </span>
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Modus
                </div>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="radio"
                    name="mode"
                    checked={preview.mode === 'merge'}
                    onChange={() => onModeChange('merge')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium">Zusammenführen</div>
                    <div className="text-xs text-muted-foreground">
                      Projekte, die nicht in der Datei sind, bleiben erhalten.
                      Vorhandene Projekte werden aktualisiert.
                    </div>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="radio"
                    name="mode"
                    checked={preview.mode === 'replace'}
                    onChange={() => onModeChange('replace')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium">Komplett ersetzen</div>
                    <div className="text-xs text-muted-foreground">
                      Alle vorhandenen Projekte werden durch die importierten
                      ersetzt. {preview.keptOrRemoved} Projekte würden gelöscht.
                    </div>
                  </div>
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Abbrechen
                </Button>
                <Button size="sm" onClick={onConfirm}>
                  Import anwenden
                </Button>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Nach Anwendung bleibt 15 Sekunden lang ein „Rückgängig"-Hinweis.
              </div>
            </>
          )}
          <Dialog.Close asChild>
            <button
              className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function fmtNum(v: number | null): string {
  if (v === null || v === undefined) return ''
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(v)
}

function parseGermanNum(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const cleaned = t.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function nlOf(fachbereich: string): 'DE' | 'PL' | '' {
  const f = fachbereich.toLowerCase()
  if (f.includes('wroclaw') || f.includes('sp. z o') || f.includes('pl-') || /\bpl\b/.test(f)) {
    return 'PL'
  }
  if (f.includes('merkin') || f.includes('gmbh') || f.includes('deutschland') || /\bde\b/.test(f)) {
    return 'DE'
  }
  return ''
}

// ---------------------------------------------------------------------------
// Excel import — maps the "Ausdruck" sheet to ProjektlisteRow rows.
// ---------------------------------------------------------------------------

function parseWorkbook(wb: XLSX.WorkBook): Omit<ProjektlisteRow, 'id' | 'updatedAt'>[] {
  const name =
    wb.SheetNames.find((n) => n.toLowerCase().includes('ausdruck')) ??
    wb.SheetNames[0]
  const ws = wb.Sheets[name]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
  })
  return rows
    .map((r) => mapRow(r))
    .filter((r): r is Omit<ProjektlisteRow, 'id' | 'updatedAt'> => !!r)
}

function mapRow(r: Record<string, unknown>): Omit<ProjektlisteRow, 'id' | 'updatedAt'> | null {
  const projekt = str(r['Projekt'])
  if (!projekt) return null
  return {
    projekt,
    fachbereich: str(r['Fachbereich']),
    projektleiter: str(r['Projektleiter']),
    status: str(r['Status']),
    leistung: str(r['Leistung in Worten']),
    abrechnungsstandEur: num(r['Abrechnungsstand €']),
    personalkosten: num(r['Personalkosten']),
    direkteKosten: num(r['direkte Kosten']),
    kostensumme: num(r['Kostensumme']),
    gewinnVerlust: num(r['Gewinn/Verlust aktuell']),
    forecastGesamt: num(r['Forecast Gesamt']),
    forecastGesamtFlag: flag(r['k/w']),
    forecastPl: num(r['Forecast PL']),
    forecastPlFlag: flag(r['k/w_1'] ?? r['k/w 1']),
    forecastDe: num(r['Forecast DE']),
    forecastDeFlag: flag(r['w/k'] ?? r['k/w_2'] ?? r['k/w 2']),
    abgerechnetGesamt: num(r['Abgerechnet Gesamt']),
    abgerechnetPl: num(r['Abgerechnet PL']),
    abgerechnetDe: num(r['Abgerechnet DE']),
    offenerForecastDe: num(r['Noch nicht umgesetzter Forecast DE']),
    offenerForecastPl: num(r['Noch nicht umgesetzter Forecast PL']),
  }
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function flag(v: unknown): ForecastFlag {
  if (v === null || v === undefined) return null
  const s = String(v).trim().toLowerCase()
  if (s === 'k') return 'k'
  if (s === 'w') return 'w'
  return null
}
