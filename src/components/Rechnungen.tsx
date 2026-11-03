import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useRechnungen } from '@/rechnungen-store'
import {
  bruttoOf,
  RECHNUNG_STATUSES,
  RECHNUNG_STATUS_LABELS,
  type Rechnung,
  type RechnungStatus,
} from '@/types'
import { Section } from '@/components/ui/section'
import { NumCell } from './NumCell'
import { TextCell } from './TextCell'
import { fmtEUR } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_CHIP: Record<RechnungStatus, string> = {
  offen: 'bg-muted text-muted-foreground',
  bezahlt: 'bg-emerald-100 text-emerald-900',
  mahnung: 'bg-amber-100 text-amber-900',
  storniert: 'bg-destructive/10 text-destructive',
}

export function Rechnungen() {
  const data = useRechnungen((s) => s.data)
  const addRow = useRechnungen((s) => s.addRow)
  const updateRow = useRechnungen((s) => s.updateRow)
  const removeRow = useRechnungen((s) => s.removeRow)
  const setStatus = useRechnungen((s) => s.setStatus)

  const rows = data?.rows ?? []

  const totals = useMemo(() => {
    let netto = 0
    let brutto = 0
    let offenNetto = 0
    let bezahltNetto = 0
    for (const r of rows) {
      const n = r.netto ?? 0
      const b = bruttoOf(r) ?? 0
      netto += n
      brutto += b
      if (r.status === 'bezahlt') bezahltNetto += n
      else if (r.status !== 'storniert') offenNetto += n
    }
    return { netto, brutto, offenNetto, bezahltNetto }
  }, [rows])

  const subtitle = data ? `${rows.length} Rechnungen · ${data.year}` : undefined

  return (
    <Section
      title="Rechnungen"
      subtitle={subtitle}
      padded={false}
    >
      <div className="w-full max-h-[calc(100vh-300px)] overflow-auto">
        <table className="w-full min-w-[1200px] border-collapse text-sm">
          <colgroup>
            <col className="w-28" /> {/* Nr */}
            <col className="w-28" /> {/* Datum */}
            <col className="min-w-[180px]" /> {/* Kunde */}
            <col className="min-w-[200px]" /> {/* Projekt */}
            <col className="w-28" /> {/* Netto */}
            <col className="w-16" /> {/* USt% */}
            <col className="w-28" /> {/* Brutto */}
            <col className="w-24" /> {/* Status */}
            <col className="w-28" /> {/* Fällig */}
            <col className="w-28" /> {/* Bezahlt */}
            <col className="min-w-[160px]" /> {/* Notiz */}
            <col className="w-10" />
          </colgroup>

          <thead className="sticky top-0 z-20 bg-muted">
            <tr className="border-b">
              <Th>Nr.</Th>
              <Th>Datum</Th>
              <Th>Kunde</Th>
              <Th>Projekt</Th>
              <Th className="num">Netto</Th>
              <Th className="num">USt %</Th>
              <Th className="num text-muted-foreground">Brutto</Th>
              <Th>Status</Th>
              <Th>Fällig</Th>
              <Th>Bezahlt am</Th>
              <Th>Notiz</Th>
              <Th></Th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Noch keine Rechnungen. Füge eine hinzu.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <Row
                key={row.id}
                row={row}
                onUpdate={(patch) => updateRow(row.id, patch)}
                onDelete={() => removeRow(row.id)}
                onStatus={(s) => setStatus(row.id, s)}
              />
            ))}
            <tr>
              <td colSpan={12} className="p-0">
                <button
                  onClick={addRow}
                  className="flex w-full items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Rechnung hinzufügen
                </button>
              </td>
            </tr>
          </tbody>

          <tfoot className="border-t">
            <tr className="border-t-2 border-foreground/20 font-semibold">
              <td colSpan={4} className="px-3 py-2 text-xs font-medium text-muted-foreground">
                Summe
              </td>
              <td className="num px-2 py-2 text-sm">{fmtEUR(totals.netto) || '—'}</td>
              <td />
              <td className="num px-2 py-2 text-sm">{fmtEUR(totals.brutto) || '—'}</td>
              <td colSpan={5} />
            </tr>
            <tr>
              <td colSpan={4} className="px-3 py-2 text-xs text-muted-foreground">
                davon offen (netto)
              </td>
              <td className="num px-2 py-2 text-sm text-muted-foreground">
                {fmtEUR(totals.offenNetto) || '—'}
              </td>
              <td colSpan={7} />
            </tr>
            <tr>
              <td colSpan={4} className="px-3 py-2 text-xs text-muted-foreground">
                davon bezahlt (netto)
              </td>
              <td className="num px-2 py-2 text-sm text-emerald-700">
                {fmtEUR(totals.bezahltNetto) || '—'}
              </td>
              <td colSpan={7} />
            </tr>
          </tfoot>
        </table>
      </div>
    </Section>
  )
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn('px-2 py-2 text-left text-xs font-medium text-muted-foreground', className)}>
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('align-top', className)}>{children}</td>
}

function Row({
  row,
  onUpdate,
  onDelete,
  onStatus,
}: {
  row: Rechnung
  onUpdate: (patch: Partial<Omit<Rechnung, 'id'>>) => void
  onDelete: () => void
  onStatus: (s: RechnungStatus) => void
}) {
  const brutto = bruttoOf(row)
  return (
    <tr className="group border-b last:border-b-0 hover:bg-accent">
      <Td>
        <TextCell value={row.nr} onChange={(v) => onUpdate({ nr: v })} className="font-mono text-xs" />
      </Td>
      <Td>
        <DateCell value={row.datum} onChange={(v) => onUpdate({ datum: v })} />
      </Td>
      <Td>
        <TextCell value={row.kunde} onChange={(v) => onUpdate({ kunde: v })} placeholder="Kunde" />
      </Td>
      <Td>
        <TextCell value={row.projekt} onChange={(v) => onUpdate({ projekt: v })} placeholder="Projekt" />
      </Td>
      <Td>
        <NumCell value={row.netto} onChange={(v) => onUpdate({ netto: v })} />
      </Td>
      <Td>
        <NumCell value={row.ustPct} onChange={(v) => onUpdate({ ustPct: v })} decimals={0} />
      </Td>
      <Td>
        <NumCell value={brutto} readOnly />
      </Td>
      <Td>
        <StatusSelect value={row.status} onChange={onStatus} />
      </Td>
      <Td>
        <DateCell value={row.faellig} onChange={(v) => onUpdate({ faellig: v })} />
      </Td>
      <Td>
        <DateCell value={row.bezahltAm} onChange={(v) => onUpdate({ bezahltAm: v })} />
      </Td>
      <Td>
        <TextCell value={row.notiz} onChange={(v) => onUpdate({ notiz: v })} placeholder="…" />
      </Td>
      <Td>
        <button
          onClick={onDelete}
          className="rounded-md p-1.5 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-accent hover:text-destructive group-hover:opacity-100"
          title="Zeile löschen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </Td>
    </tr>
  )
}

function DateCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-accent/60"
    />
  )
}

function StatusSelect({ value, onChange }: { value: RechnungStatus; onChange: (s: RechnungStatus) => void }) {
  return (
    <div className="px-1 py-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RechnungStatus)}
        className={cn(
          'rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wider outline-none',
          STATUS_CHIP[value],
        )}
      >
        {RECHNUNG_STATUSES.map((s) => (
          <option key={s} value={s}>
            {RECHNUNG_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  )
}
