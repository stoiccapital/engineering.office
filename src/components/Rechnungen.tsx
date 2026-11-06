import { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  ArrowDownToLine,
  Calendar,
  Plus,
  Settings as SettingsIcon,
  Trash2,
} from 'lucide-react'
import { useRechnungen } from '@/rechnungen-store'
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
        onChangeNachtragCount={setNachtragCount}
        onToggleZeithonorar={setShowZeithonorar}
      />

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
                <Th className="num w-[132px] text-right">Σ DE</Th>
                <Th className="num w-[132px] text-right">Σ PL</Th>
                <Th
                  className="num w-[132px] text-right"
                  title="Nachträge für erbrachte Leistung"
                >
                  Erbr. Leistung
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
                      value={row.rgSummeDE}
                      onChange={(v) => updateRow(row.id, { rgSummeDE: v })}
                      className="text-right"
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

function computeTotals(data: Rechnungsplan | null) {
  const acc = { rgSummeDE: 0, rgSummePL: 0, erbrachteLeistung: 0 }
  if (!data) return acc
  for (const r of data.rows) {
    acc.rgSummeDE += r.rgSummeDE ?? 0
    acc.rgSummePL += r.rgSummePL ?? 0
    acc.erbrachteLeistung += r.nachtragErbracht ?? 0
  }
  return acc
}

function totalColSpan(data: Rechnungsplan): number {
  return (
    5 + 1 + data.nachtragCount + (data.showZeithonorar ? 1 : 0) + data.noteColumns.length + 3 + 1
  )
}

function summaryLabelSpan(data: Rechnungsplan): number {
  return totalColSpan(data) - 4
}

function Toolbar({
  plan,
  onCopyPrevious,
  onChangeNachtragCount,
  onToggleZeithonorar,
}: {
  plan: Rechnungsplan
  onCopyPrevious: () => void
  onChangeNachtragCount: (n: number) => void
  onToggleZeithonorar: (show: boolean) => void
}) {
  return (
    <div className="flex items-center justify-end gap-2">
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
      className="w-full bg-transparent px-1 text-xs font-medium outline-none transition-colors hover:bg-accent/40 focus:bg-accent/60"
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
