import { useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowDownToLine,
  Calendar,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useRechnungen } from '@/rechnungen-store'
import { saveRechnungsplan } from '@/api'
import { parseWorkbook, type ImportResult } from '@/lib/rechnungen-import'
import {
  N_STATUS_LABELS,
  PL_BRANCH_LABELS,
  PL_BRANCH_STATUSES,
  type NEntry,
  type NStatus,
  type PlBranchStatus,
  type Rechnungsplan,
} from '@/types'
import { Section } from '@/components/ui/section'
import { Num } from '@/components/ui/num'
import { NumCell } from './NumCell'
import { TextCell } from './TextCell'
import { fmtEUR } from '@/lib/format'
import { cn } from '@/lib/utils'

// 4-state cycle used for HV + N0x cells.
const N_CYCLE: NStatus[] = ['aktuell', 'neu', 'rgGestellt', 'nichtRelevant']
// 3-state cycle for "Deutschland" column (no nichtRelevant).
const DE_CYCLE: NStatus[] = ['aktuell', 'neu', 'rgGestellt']

const N_STATUS_CHIP: Record<NStatus, string> = {
  aktuell: 'bg-sky-100 text-sky-900 border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200',
  nichtRelevant: 'bg-muted text-muted-foreground border-border',
  neu: 'bg-amber-100 text-amber-900 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200',
  rgGestellt:
    'bg-emerald-100 text-emerald-900 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200',
}

const N_STATUS_SHORT: Record<NStatus, string> = {
  aktuell: 'Aktuell',
  nichtRelevant: '–',
  neu: 'Neu',
  rgGestellt: 'Rg.',
}

const PL_BRANCH_CHIP: Record<PlBranchStatus, string> = {
  nein: 'bg-muted text-muted-foreground',
  ja: 'bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200',
  neu: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
}

function cycle<T>(arr: T[], current: T): T {
  const i = arr.indexOf(current)
  return arr[(i + 1) % arr.length]
}

function fmtShortDate(iso: string): string {
  // "2026-11-06" → "06.11."
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[3]}.${m[2]}.`
}

export function Rechnungen() {
  const data = useRechnungen((s) => s.data)
  const addRow = useRechnungen((s) => s.addRow)
  const removeRow = useRechnungen((s) => s.removeRow)
  const updateRow = useRechnungen((s) => s.updateRow)
  const updateNote = useRechnungen((s) => s.updateNote)
  const updateNEntry = useRechnungen((s) => s.updateNEntry)
  const setNachtragCount = useRechnungen((s) => s.setNachtragCount)
  const setShowZeithonorar = useRechnungen((s) => s.setShowZeithonorar)
  const renameNoteColumn = useRechnungen((s) => s.renameNoteColumn)
  const copyFromPreviousMonth = useRechnungen((s) => s.copyFromPreviousMonth)

  const totals = useMemo(() => computeTotals(data), [data])
  const [importOpen, setImportOpen] = useState(false)

  if (!data) return null

  const triggerCopy = () => {
    if (data.rows.length > 0) {
      const ok = confirm(
        'Aktueller Monat enthält bereits Zeilen. Diese werden durch die Vormonats-Projekte ersetzt. Fortfahren?',
      )
      if (!ok) return
    }
    void copyFromPreviousMonth()
  }

  return (
    <div className="space-y-4">
      <Toolbar
        plan={data}
        onCopyPrevious={triggerCopy}
        onOpenImport={() => setImportOpen(true)}
        onChangeNachtragCount={setNachtragCount}
        onToggleZeithonorar={setShowZeithonorar}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <Section
        title="Rechnungsplanung"
        subtitle={
          <>
            <Num>{data.rows.length}</Num> Projekte · DE Σ {fmtEUR(totals.rgSummeDE) || '0'} € · PL Σ{' '}
            {fmtEUR(totals.rgSummePL) || '0'} €
            {totals.erbrachteLeistung > 0 && (
              <> · Erbr. Leistung {fmtEUR(totals.erbrachteLeistung)} €</>
            )}
          </>
        }
        padded={false}
      >
        <div className="overflow-auto">
          <table className="w-max min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-muted/90 backdrop-blur">
              <tr className="border-b font-medium text-muted-foreground">
                <Th className="w-[88px] text-left">Polen</Th>
                <Th className="w-[104px] text-left">DE</Th>
                <Th className="w-[120px] text-left">Proj. Nr.</Th>
                <Th className="min-w-[320px] text-left">Projekte</Th>
                <Th className="w-[80px] text-left">PL</Th>
                <Th className="w-[172px] text-center">HV</Th>
                {Array.from({ length: data.nachtragCount }).map((_, i) => (
                  <Th key={`n${i}`} className="w-[172px] text-center">
                    N{String(i + 1).padStart(2, '0')}
                  </Th>
                ))}
                {data.showZeithonorar && (
                  <Th className="w-[180px] text-center">Zeithonorar</Th>
                )}
                {data.noteColumns.map((n) => (
                  <Th key={n.id} className="min-w-[220px] text-left">
                    <EditableColumnLabel
                      value={n.label}
                      onChange={(v) => renameNoteColumn(n.id, v)}
                    />
                  </Th>
                ))}
                <Th className="num w-[132px] text-right">Rg. Gesamt</Th>
                <Th
                  className="num w-[132px] text-right"
                  title="= Rg. Gesamt − Rg. PL − Rg. extern"
                >
                  Rg. DE
                </Th>
                <Th className="num w-[132px] text-right">Rg. PL</Th>
                <Th
                  className="num w-[132px] text-right"
                  title="Extern erbrachte Leistung"
                >
                  Rg. extern
                </Th>
                <Th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.id}
                  className="group border-b last:border-b-0 hover:bg-accent/30"
                >
                  <td className="px-1.5 py-0.5">
                    <ChipButton
                      onClick={() =>
                        updateRow(row.id, { plBranch: cycle(PL_BRANCH_STATUSES, row.plBranch) })
                      }
                      className={PL_BRANCH_CHIP[row.plBranch]}
                      title="Klicken zum Wechseln"
                    >
                      {PL_BRANCH_LABELS[row.plBranch]}
                    </ChipButton>
                  </td>
                  <td className="px-1.5 py-0.5">
                    <ChipButton
                      onClick={() =>
                        updateRow(row.id, { deStatus: cycle(DE_CYCLE, row.deStatus) })
                      }
                      className={N_STATUS_CHIP[row.deStatus]}
                      title="Klicken zum Wechseln"
                    >
                      {N_STATUS_SHORT[row.deStatus]}
                    </ChipButton>
                  </td>
                  <td className="px-1 py-0.5">
                    <TextCell
                      value={row.projNr}
                      onChange={(v) => updateRow(row.id, { projNr: v })}
                      placeholder="24D001"
                      className="font-mono text-[11px]"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <TextCell
                      value={row.projektname}
                      onChange={(v) => updateRow(row.id, { projektname: v })}
                      placeholder="Projektname"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <TextCell
                      value={row.pl}
                      onChange={(v) => updateRow(row.id, { pl: v })}
                      placeholder="MuA"
                      className="font-mono text-[11px]"
                    />
                  </td>
                  <NEntryCell
                    entry={row.hv}
                    onChange={(patch) => updateNEntry(row.id, { kind: 'hv' }, patch)}
                  />
                  {row.nachtraege.map((n, i) => (
                    <NEntryCell
                      key={`n${i}`}
                      entry={n}
                      onChange={(patch) =>
                        updateNEntry(row.id, { kind: 'nachtrag', index: i }, patch)
                      }
                    />
                  ))}
                  {data.showZeithonorar && (
                    <NEntryCell
                      entry={row.zeithonorar ?? { status: 'nichtRelevant' }}
                      onChange={(patch) => updateNEntry(row.id, { kind: 'zeithonorar' }, patch)}
                    />
                  )}
                  {data.noteColumns.map((n) => (
                    <td key={n.id} className="px-1 py-0.5 align-top">
                      <TextCell
                        value={row.notes[n.id] ?? ''}
                        onChange={(v) => updateNote(row.id, n.id, v)}
                        placeholder="…"
                        multiline
                      />
                    </td>
                  ))}
                  <td className="px-1 py-0.5">
                    <NumCell
                      value={row.rgGesamt}
                      onChange={(v) => updateRow(row.id, { rgGesamt: v })}
                      className="text-right"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <NumCell
                      value={computedRgDe(row)}
                      readOnly
                      className="text-right text-muted-foreground"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <NumCell
                      value={row.rgSummePL}
                      onChange={(v) => updateRow(row.id, { rgSummePL: v })}
                      className="text-right"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <NumCell
                      value={row.nachtragErbracht}
                      onChange={(v) => updateRow(row.id, { nachtragErbracht: v })}
                      className="text-right"
                    />
                  </td>
                  <td className="px-1 py-0.5 text-right">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      title="Zeile löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={totalColSpan(data)} className="p-0">
                  <button
                    onClick={addRow}
                    className="flex w-full items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Projekt hinzufügen
                  </button>
                </td>
              </tr>
              <tr className="border-t-2 border-foreground/20 bg-muted/40 font-semibold">
                <td
                  colSpan={summaryLabelSpan(data)}
                  className="px-2 py-2 text-right text-xs text-muted-foreground"
                >
                  Σ Gesamt
                </td>
                <td className="num px-2 py-2 text-right font-mono tabular-nums">
                  {fmtEUR(totals.rgGesamt) || '—'} €
                </td>
                <td className="num px-2 py-2 text-right font-mono tabular-nums">
                  {fmtEUR(totals.rgSummeDE) || '—'} €
                </td>
                <td className="num px-2 py-2 text-right font-mono tabular-nums">
                  {fmtEUR(totals.rgSummePL) || '—'} €
                </td>
                <td className="num px-2 py-2 text-right font-mono tabular-nums">
                  {fmtEUR(totals.erbrachteLeistung) || '—'} €
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

// Rg. DE is derived from Rg. Gesamt − Rg. PL − Rg. extern per row. When any
// of the three inputs is null, we treat it as 0 for the calculation so the
// user sees the running total immediately.
function computedRgDe(r: {
  rgGesamt: number | null
  rgSummePL: number | null
  nachtragErbracht: number | null
}): number | null {
  if (r.rgGesamt === null && r.rgSummePL === null && r.nachtragErbracht === null) {
    return null
  }
  return (r.rgGesamt ?? 0) - (r.rgSummePL ?? 0) - (r.nachtragErbracht ?? 0)
}

function computeTotals(data: Rechnungsplan | null) {
  const acc = { rgGesamt: 0, rgSummeDE: 0, rgSummePL: 0, erbrachteLeistung: 0 }
  if (!data) return acc
  for (const r of data.rows) {
    acc.rgGesamt += r.rgGesamt ?? 0
    acc.rgSummeDE += computedRgDe(r) ?? 0
    acc.rgSummePL += r.rgSummePL ?? 0
    acc.erbrachteLeistung += r.nachtragErbracht ?? 0
  }
  return acc
}

function totalColSpan(data: Rechnungsplan): number {
  // 5 chip/text cols, 1 HV, N nachträge, optional Zeithonorar, note columns,
  // 4 Rg. columns (Gesamt, DE, PL, extern), 1 trash col.
  return (
    5 + 1 + data.nachtragCount + (data.showZeithonorar ? 1 : 0) + data.noteColumns.length + 4 + 1
  )
}

function summaryLabelSpan(data: Rechnungsplan): number {
  // Footer renders 4 totals + trash cell at the right.
  return totalColSpan(data) - 5
}

function Toolbar({
  plan,
  onCopyPrevious,
  onOpenImport,
  onChangeNachtragCount,
  onToggleZeithonorar,
}: {
  plan: Rechnungsplan
  onCopyPrevious: () => void
  onOpenImport: () => void
  onChangeNachtragCount: (n: number) => void
  onToggleZeithonorar: (show: boolean) => void
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={onOpenImport}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Excel-Datei (.xlsx) mit Monats-Sheets importieren"
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </button>
      <button
        onClick={onCopyPrevious}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Übernimmt die Projektzeilen aus dem Vormonat. Rechnungssummen und Status werden zurückgesetzt."
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        Vom Vormonat übernehmen
      </button>
      <SettingsPopover
        plan={plan}
        onChangeNachtragCount={onChangeNachtragCount}
        onToggleZeithonorar={onToggleZeithonorar}
      />
    </div>
  )
}

function SettingsPopover({
  plan,
  onChangeNachtragCount,
  onToggleZeithonorar,
}: {
  plan: Rechnungsplan
  onChangeNachtragCount: (n: number) => void
  onToggleZeithonorar: (show: boolean) => void
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border bg-card p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Monats-Einstellungen"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-64 rounded-md border bg-card p-3 text-sm shadow-md focus:outline-none"
        >
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground">
              Monats-Einstellungen
            </div>
            <label className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Anzahl Nachtrag-Spalten</span>
              <input
                type="number"
                min={0}
                max={20}
                value={plan.nachtragCount}
                onChange={(e) => onChangeNachtragCount(Number(e.target.value) || 0)}
                className="num w-16 rounded border bg-background px-1.5 py-0.5 text-right font-mono tabular-nums"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Zeithonorar-Spalte anzeigen</span>
              <input
                type="checkbox"
                checked={plan.showZeithonorar}
                onChange={(e) => onToggleZeithonorar(e.target.checked)}
              />
            </label>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function EditableColumnLabel({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  return (
    <input
      value={editing ? draft : value}
      onFocus={() => {
        setDraft(value)
        setEditing(true)
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false)
        if (draft !== value) onChange(draft)
      }}
      className="w-full bg-foreground/[0.03] rounded-sm px-1 text-xs font-medium outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
    />
  )
}

function ChipButton({
  onClick,
  className,
  title,
  children,
}: {
  onClick: () => void
  className?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex h-6 w-full items-center justify-center rounded border px-1.5 text-[11px] font-medium transition-colors',
        className,
      )}
    >
      {children}
    </button>
  )
}

function NEntryCell({
  entry,
  onChange,
}: {
  entry: NEntry
  onChange: (patch: Partial<NEntry>) => void
}) {
  const showDate = entry.status === 'rgGestellt'
  return (
    <td className="px-1 py-0.5 align-top">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <ChipButton
            onClick={() => onChange({ status: cycle(N_CYCLE, entry.status) })}
            className={N_STATUS_CHIP[entry.status]}
            title={`${N_STATUS_LABELS[entry.status]} · klicken zum Wechseln`}
          >
            {N_STATUS_SHORT[entry.status]}
          </ChipButton>
        </div>
        {showDate && (
          <DatePopover
            value={entry.datum}
            onChange={(v) => onChange({ datum: v || undefined })}
          />
        )}
      </div>
    </td>
  )
}

function DatePopover({
  value,
  onChange,
}: {
  value?: string
  onChange: (v: string) => void
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded border px-1.5 font-mono text-[10px] tabular-nums',
            value
              ? 'border-emerald-500/30 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200'
              : 'border-dashed text-muted-foreground hover:bg-accent',
          )}
          title={value ? 'Datum ändern' : 'Datum hinzufügen'}
        >
          <Calendar className="h-3 w-3" />
          {value ? fmtShortDate(value) : '—'}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 rounded-md border bg-card p-2 shadow-md focus:outline-none"
        >
          <input
            type="date"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="rounded border bg-background px-2 py-1 font-mono text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring"
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Th({
  children,
  className,
  title,
}: {
  children?: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <th title={title} className={cn('px-2 py-1.5 text-[11px] font-medium', className)}>
      {children}
    </th>
  )
}

const DE_MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const year = useRechnungen((s) => s.year)
  const month = useRechnungen((s) => s.month)
  const load = useRechnungen((s) => s.load)
  const fileRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [overwrite, setOverwrite] = useState(true)
  const [importing, setImporting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setResult(null)
    setStatus(null)
    setError(null)
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onFile = async (file: File) => {
    setError(null)
    setStatus(null)
    try {
      const buf = await file.arrayBuffer()
      const parsed = parseWorkbook(buf, year)
      setResult(parsed)
    } catch (e) {
      setError(`Datei konnte nicht gelesen werden: ${(e as Error).message}`)
    }
  }

  const doImport = async () => {
    if (!result) return
    setImporting(true)
    setError(null)
    const importable = result.sheets.filter((s) => s.plan !== null)
    for (let i = 0; i < importable.length; i++) {
      const s = importable[i]
      setStatus(`Schreibe ${s.sheetName} (${i + 1}/${importable.length}) …`)
      try {
        await saveRechnungsplan(result.year, s.month!, s.plan!)
      } catch (e) {
        setError(`Fehler bei ${s.sheetName}: ${(e as Error).message}`)
        setImporting(false)
        return
      }
    }
    setStatus(`${importable.length} Monate importiert.`)
    setImporting(false)
    // Reload current month so the UI reflects the imported data.
    void load()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <Dialog.Title className="text-sm font-semibold">
                Rechnungen importieren
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                Excel (.xlsx) mit einem Blatt pro Monat (Januar, Februar, …). Jahr{' '}
                <span className="font-mono tabular-nums">{year}</span> (aus dem
                Kalender-Filter).
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded p-1 text-muted-foreground hover:bg-accent"
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onFile(f)
                }}
                className="block w-full text-xs"
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {result && (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Vorschau
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-[11px] text-muted-foreground">
                      <th className="px-2 py-1 text-left">Blatt</th>
                      <th className="px-2 py-1 text-left">Monat</th>
                      <th className="px-2 py-1 text-right">Zeilen</th>
                      <th className="px-2 py-1 text-left">Hinweis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sheets.map((s) => {
                      const current =
                        s.month === month
                          ? ' (aktuell geöffnet — wird überschrieben)'
                          : ''
                      return (
                        <tr key={s.sheetName} className="border-b last:border-b-0">
                          <td className="px-2 py-1 font-mono">{s.sheetName}</td>
                          <td className="px-2 py-1">
                            {s.month
                              ? `${s.month.toString().padStart(2, '0')} · ${DE_MONTH_NAMES[s.month - 1]}`
                              : '—'}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {s.plan ? s.rowCount : '—'}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">
                            {s.error ?? current}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                  />
                  Vorhandene Monatsdaten komplett überschreiben
                </label>
                <div className="text-[11px] text-muted-foreground">
                  Hinweis: Merge ist aktuell nicht implementiert — importierte
                  Monate werden immer überschrieben. Das Häkchen bestätigt dein
                  Einverständnis.
                </div>
              </div>
            )}

            {status && (
              <div className="rounded-md border bg-accent/40 px-3 py-2 text-xs">
                {status}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
            <button
              type="button"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
              className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={!result || importing || !overwrite}
              onClick={() => void doImport()}
              className="rounded-md border bg-foreground px-3 py-1.5 text-xs text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing
                ? 'Importiere …'
                : `Alle ${result?.sheets.filter((s) => s.plan).length ?? 0} Monate importieren`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
