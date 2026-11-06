import { useMemo, useState } from 'react'
import { ArrowDownToLine, Plus, Trash2 } from 'lucide-react'
import { useRechnungen } from '@/rechnungen-store'
import {
  N_STATUSES,
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

const N_STATUS_CHIP: Record<NStatus, string> = {
  aktuell: 'bg-sky-100 text-sky-900 border-sky-500/30',
  nichtRelevant: 'bg-muted text-muted-foreground border-border',
  neu: 'bg-amber-100 text-amber-900 border-amber-500/30',
  rgGestellt: 'bg-emerald-100 text-emerald-900 border-emerald-500/30',
}

const PL_BRANCH_CHIP: Record<PlBranchStatus, string> = {
  nein: 'bg-muted text-muted-foreground',
  ja: 'bg-sky-100 text-sky-900',
  neu: 'bg-amber-100 text-amber-900',
}

const DE_STATUSES: NStatus[] = ['aktuell', 'neu', 'rgGestellt']
const DE_STATUS_SHORT: Record<NStatus, string> = {
  aktuell: 'Aktuell',
  nichtRelevant: '–',
  neu: 'Neu',
  rgGestellt: 'Rg.Gestellt',
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

  return (
    <div className="space-y-6">
      <MonthToolbar
        plan={data}
        onCopyPrevious={() => void copyFromPreviousMonth()}
        onChangeNachtragCount={setNachtragCount}
        onToggleZeithonorar={setShowZeithonorar}
        onRenameNoteColumn={renameNoteColumn}
      />

      <Section
        title="Rechnungsplanung"
        subtitle={
          <>
            <Num>{data.rows.length}</Num> Projekte · DE Σ {fmtEUR(totals.rgSummeDE) || '0'} € · PL Σ{' '}
            {fmtEUR(totals.rgSummePL) || '0'} €
          </>
        }
        padded={false}
      >
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-muted/60">
              <tr className="border-b text-xs font-medium text-muted-foreground">
                <Th className="w-16 text-left">PL</Th>
                <Th className="w-20 text-left">DE</Th>
                <Th className="w-20 text-left">Proj. Nr.</Th>
                <Th className="min-w-[240px] text-left">Projekte</Th>
                <Th className="w-16 text-left">Lead</Th>
                <Th className="w-20 text-center">HV</Th>
                {Array.from({ length: data.nachtragCount }).map((_, i) => (
                  <Th key={`n${i}`} className="w-20 text-center">
                    N{String(i + 1).padStart(2, '0')}
                  </Th>
                ))}
                {data.showZeithonorar && <Th className="w-20 text-center">Zeithonorar</Th>}
                {data.noteColumns.map((n) => (
                  <Th key={n.id} className="min-w-[160px] text-left">
                    <EditableColumnLabel
                      value={n.label}
                      onChange={(v) => renameNoteColumn(n.id, v)}
                    />
                  </Th>
                ))}
                <Th className="num w-28 text-right">Σ DE</Th>
                <Th className="num w-28 text-right">Σ PL</Th>
                <Th className="num w-28 text-right">Nachträge</Th>
                <Th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="group border-b last:border-b-0 hover:bg-accent/30">
                  <td className="px-2 py-1">
                    <PlBranchSelect
                      value={row.plBranch}
                      onChange={(v) => updateRow(row.id, { plBranch: v })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <DeStatusSelect
                      value={row.deStatus}
                      onChange={(v) => updateRow(row.id, { deStatus: v })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <TextCell
                      value={row.projNr}
                      onChange={(v) => updateRow(row.id, { projNr: v })}
                      placeholder="24D001"
                      className="font-mono text-xs"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <TextCell
                      value={row.projektname}
                      onChange={(v) => updateRow(row.id, { projektname: v })}
                      placeholder="Projektname"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <TextCell
                      value={row.pl}
                      onChange={(v) => updateRow(row.id, { pl: v })}
                      placeholder="MuA"
                      className="font-mono text-xs"
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
                    <td key={n.id} className="px-2 py-1 align-top">
                      <TextCell
                        value={row.notes[n.id] ?? ''}
                        onChange={(v) => updateNote(row.id, n.id, v)}
                        placeholder="…"
                        multiline
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <NumCell
                      value={row.rgSummeDE}
                      onChange={(v) => updateRow(row.id, { rgSummeDE: v })}
                      className="text-right"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <NumCell
                      value={row.rgSummePL}
                      onChange={(v) => updateRow(row.id, { rgSummePL: v })}
                      className="text-right"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <NumCell
                      value={row.nachtragErbracht}
                      onChange={(v) => updateRow(row.id, { nachtragErbracht: v })}
                      className="text-right"
                    />
                  </td>
                  <td className="px-1 py-1 text-right">
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
              <tr className="border-t-2 border-foreground/20 font-semibold">
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
                  {fmtEUR(totals.nachtragErbracht) || '—'} €
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
  const acc = { rgSummeDE: 0, rgSummePL: 0, nachtragErbracht: 0 }
  if (!data) return acc
  for (const r of data.rows) {
    acc.rgSummeDE += r.rgSummeDE ?? 0
    acc.rgSummePL += r.rgSummePL ?? 0
    acc.nachtragErbracht += r.nachtragErbracht ?? 0
  }
  return acc
}

function totalColSpan(data: Rechnungsplan): number {
  // PL + DE + ProjNr + Projektname + Lead + HV + Nxx + (Zeithonorar?) + notes + 3 sums + delete
  return (
    5 + 1 + data.nachtragCount + (data.showZeithonorar ? 1 : 0) + data.noteColumns.length + 3 + 1
  )
}

function summaryLabelSpan(data: Rechnungsplan): number {
  // Everything before the 3 sum columns.
  return totalColSpan(data) - 4
}

function MonthToolbar({
  plan,
  onCopyPrevious,
  onChangeNachtragCount,
  onToggleZeithonorar,
  onRenameNoteColumn: _onRenameNoteColumn,
}: {
  plan: Rechnungsplan
  onCopyPrevious: () => void
  onChangeNachtragCount: (n: number) => void
  onToggleZeithonorar: (show: boolean) => void
  onRenameNoteColumn: (id: string, label: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Nachtrag-Spalten</span>
          <input
            type="number"
            min={0}
            max={20}
            value={plan.nachtragCount}
            onChange={(e) => onChangeNachtragCount(Number(e.target.value) || 0)}
            className="num w-14 rounded border bg-background px-1.5 py-0.5 text-right font-mono tabular-nums"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={plan.showZeithonorar}
            onChange={(e) => onToggleZeithonorar(e.target.checked)}
          />
          <span>Zeithonorar-Spalte</span>
        </label>
      </div>
      <button
        onClick={onCopyPrevious}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Übernimmt die Projektzeilen aus dem Vormonat. Rechnungssummen und Status werden zurückgesetzt."
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        Vom Vormonat übernehmen
      </button>
    </div>
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
      className="w-full bg-transparent px-1 text-xs font-medium outline-none focus:bg-background focus:ring-1 focus:ring-ring"
    />
  )
}

function PlBranchSelect({
  value,
  onChange,
}: {
  value: PlBranchStatus
  onChange: (v: PlBranchStatus) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PlBranchStatus)}
      className={cn(
        'w-full rounded px-1.5 py-1 text-[11px] font-medium outline-none',
        PL_BRANCH_CHIP[value],
      )}
    >
      {PL_BRANCH_STATUSES.map((s) => (
        <option key={s} value={s}>
          {PL_BRANCH_LABELS[s]}
        </option>
      ))}
    </select>
  )
}

function DeStatusSelect({
  value,
  onChange,
}: {
  value: NStatus
  onChange: (v: NStatus) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as NStatus)}
      className={cn(
        'w-full rounded px-1.5 py-1 text-[11px] font-medium outline-none',
        N_STATUS_CHIP[value],
      )}
    >
      {DE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {DE_STATUS_SHORT[s]}
        </option>
      ))}
    </select>
  )
}

function NEntryCell({
  entry,
  onChange,
}: {
  entry: NEntry
  onChange: (patch: Partial<NEntry>) => void
}) {
  return (
    <td className="px-1 py-1 align-top">
      <div className="flex flex-col gap-0.5">
        <select
          value={entry.status}
          onChange={(e) => onChange({ status: e.target.value as NStatus })}
          className={cn(
            'w-full rounded border px-1.5 py-0.5 text-[11px] font-medium outline-none',
            N_STATUS_CHIP[entry.status],
          )}
        >
          {N_STATUSES.map((s) => (
            <option key={s} value={s}>
              {N_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {entry.status === 'rgGestellt' && (
          <input
            type="date"
            value={entry.datum ?? ''}
            onChange={(e) => onChange({ datum: e.target.value || undefined })}
            className="w-full rounded border bg-background px-1 py-0.5 font-mono text-[10px] tabular-nums outline-none focus:ring-1 focus:ring-ring"
          />
        )}
      </div>
    </td>
  )
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('px-2 py-1.5 text-xs font-medium', className)}>{children}</th>
}
