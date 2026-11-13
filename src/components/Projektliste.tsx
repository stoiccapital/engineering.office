import { useMemo, useRef, useState } from 'react'
import { AlertCircle, Plus, Search, Trash2, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { LoadingCard } from '@/components/ui/loading-card'
import {
  useProjektliste,
  visibleRows,
} from '@/projektliste-store'
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
  const addRow = useProjektliste((s) => s.addRow)
  const updateRow = useProjektliste((s) => s.updateRow)
  const removeRow = useProjektliste((s) => s.removeRow)
  const importRows = useProjektliste((s) => s.importRows)

  const fileRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<{
    added: number
    updated: number
  } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const shown = useMemo(() => {
    if (!doc) return []
    return visibleRows(doc, search, statusFilter)
  }, [doc, search, statusFilter])

  const statusOptions = useMemo(() => {
    if (!doc) return []
    const seen = new Set<string>()
    for (const r of doc.rows) if (r.status) seen.add(r.status)
    return Array.from(seen).sort()
  }, [doc])

  if (!doc && status === 'loading') return <LoadingCard>Lade Projektliste…</LoadingCard>
  if (!doc) return <LoadingCard>Lade Projektliste…</LoadingCard>

  const summe = {
    kosten: shown.reduce((s, r) => s + (r.kostensumme ?? 0), 0),
    gewinn: shown.reduce((s, r) => s + (r.gewinnVerlust ?? 0), 0),
    forecast: shown.reduce((s, r) => s + (r.forecastGesamt ?? 0), 0),
    abgerechnet: shown.reduce((s, r) => s + (r.abgerechnetGesamt ?? 0), 0),
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset input so the same file can be re-picked
    if (!file) return
    setImportError(null)
    setImportResult(null)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const rows = parseWorkbook(wb)
      if (rows.length === 0) {
        setImportError('Keine Zeilen im Blatt "Ausdruck" gefunden.')
        return
      }
      const res = importRows(rows)
      setImportResult(res)
    } catch (err) {
      setImportError((err as Error).message || 'Import fehlgeschlagen.')
    }
  }

  return (
    <div className="space-y-4">
      <Section
        title="Projektliste"
        subtitle={`${doc.rows.length} ${doc.rows.length === 1 ? 'Projekt' : 'Projekte'}${doc.importedAt ? ` · Import ${new Date(doc.importedAt).toLocaleDateString('de-DE')}` : ''}`}
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
              <Plus className="mr-1 h-3.5 w-3.5" /> Projekt
            </Button>
          </div>
        }
      >
        {(importResult || importError) && (
          <div className="border-b px-4 py-2">
            {importResult && (
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900">
                  Import ok
                </span>
                <span className="text-muted-foreground">
                  {importResult.added} neu · {importResult.updated} aktualisiert
                </span>
                <button
                  onClick={() => setImportResult(null)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            )}
            {importError && (
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
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1800px] border-collapse text-[13px]">
            <thead className="bg-muted/60">
              <tr className="border-b text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="sticky left-0 z-10 w-72 bg-muted/60 px-3 py-2 text-left">
                  Projekt
                </th>
                <th className="w-16 px-2 py-2 text-left">NL</th>
                <th className="w-32 px-2 py-2 text-left">Projektleiter</th>
                <th className="w-36 px-2 py-2 text-left">Status</th>
                <th className="w-32 px-2 py-2 text-right">Abrechn.-Stand</th>
                <th className="w-28 px-2 py-2 text-right">Personalk.</th>
                <th className="w-28 px-2 py-2 text-right">direkte K.</th>
                <th className="w-28 px-2 py-2 text-right">Kostensumme</th>
                <th className="w-28 px-2 py-2 text-right">G / V</th>
                <th className="px-2 py-2 text-left">Leistung</th>
                <th className="w-32 px-2 py-2 text-right">Forecast Σ</th>
                <th className="w-28 px-2 py-2 text-right">Forecast PL</th>
                <th className="w-28 px-2 py-2 text-right">Forecast DE</th>
                <th className="w-28 px-2 py-2 text-right">Abger. Σ</th>
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
                    {doc.rows.length === 0
                      ? 'Noch keine Projektliste geladen. Klick auf „Import Excel", um ein Export-Sheet einzulesen.'
                      : 'Keine Treffer.'}
                  </td>
                </tr>
              ) : (
                shown.map((r) => (
                  <Row
                    key={r.id}
                    row={r}
                    onUpdate={(patch) => updateRow(r.id, patch)}
                    onRemove={() => removeRow(r.id)}
                  />
                ))
              )}
            </tbody>
            {shown.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/60 font-semibold">
                  <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2">
                    Σ {shown.length}
                  </td>
                  <td colSpan={6} />
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {fmtEUR(summe.kosten)}
                  </td>
                  <td
                    className={cn(
                      'px-2 py-2 text-right font-mono tabular-nums',
                      summe.gewinn < 0 && 'text-destructive',
                      summe.gewinn > 0 && 'text-emerald-700 dark:text-emerald-300',
                    )}
                  >
                    {fmtEUR(summe.gewinn)}
                  </td>
                  <td />
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {fmtEUR(summe.forecast)}
                  </td>
                  <td colSpan={2} />
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {fmtEUR(summe.abgerechnet)}
                  </td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Section>
    </div>
  )
}

function Row({
  row,
  onUpdate,
  onRemove,
}: {
  row: ProjektlisteRow
  onUpdate: (patch: Partial<ProjektlisteRow>) => void
  onRemove: () => void
}) {
  const nlLabel = nlOf(row.fachbereich)
  const gv = row.gewinnVerlust ?? 0
  return (
    <tr className="group border-b last:border-b-0 align-middle hover:bg-accent/30">
      <td className="sticky left-0 z-10 bg-background px-3 py-1 group-hover:bg-accent/30">
        <TextCell value={row.projekt} onChange={(v) => onUpdate({ projekt: v })} placeholder="Projektname" bold />
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
        <TextCell value={row.projektleiter} onChange={(v) => onUpdate({ projektleiter: v })} placeholder="PL" />
      </td>
      <td className="px-2 py-1">
        <select
          value={row.status}
          onChange={(e) => onUpdate({ status: e.target.value })}
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
        <NumCell value={row.abrechnungsstandEur} onChange={(v) => onUpdate({ abrechnungsstandEur: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.personalkosten} onChange={(v) => onUpdate({ personalkosten: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.direkteKosten} onChange={(v) => onUpdate({ direkteKosten: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.kostensumme} onChange={(v) => onUpdate({ kostensumme: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell
          value={row.gewinnVerlust}
          onChange={(v) => onUpdate({ gewinnVerlust: v })}
          className={cn(
            gv < 0 && 'text-destructive',
            gv > 0 && 'text-emerald-700 dark:text-emerald-300',
          )}
        />
      </td>
      <td className="px-2 py-1">
        <TextCell value={row.leistung} onChange={(v) => onUpdate({ leistung: v })} placeholder="Leistung in Worten" />
      </td>
      <td className="px-2 py-1">
        <NumFlagCell
          value={row.forecastGesamt}
          flag={row.forecastGesamtFlag}
          onChangeValue={(v) => onUpdate({ forecastGesamt: v })}
          onChangeFlag={(f) => onUpdate({ forecastGesamtFlag: f })}
        />
      </td>
      <td className="px-2 py-1">
        <NumFlagCell
          value={row.forecastPl}
          flag={row.forecastPlFlag}
          onChangeValue={(v) => onUpdate({ forecastPl: v })}
          onChangeFlag={(f) => onUpdate({ forecastPlFlag: f })}
        />
      </td>
      <td className="px-2 py-1">
        <NumFlagCell
          value={row.forecastDe}
          flag={row.forecastDeFlag}
          onChangeValue={(v) => onUpdate({ forecastDe: v })}
          onChangeFlag={(f) => onUpdate({ forecastDeFlag: f })}
        />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.abgerechnetGesamt} onChange={(v) => onUpdate({ abgerechnetGesamt: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.abgerechnetPl} onChange={(v) => onUpdate({ abgerechnetPl: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.abgerechnetDe} onChange={(v) => onUpdate({ abgerechnetDe: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.offenerForecastDe} onChange={(v) => onUpdate({ offenerForecastDe: v })} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={row.offenerForecastPl} onChange={(v) => onUpdate({ offenerForecastPl: v })} />
      </td>
      <td className="px-1 py-1 text-right">
        <button
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label="Projekt löschen"
          title="Löschen"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  )
}

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
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
        onChange(n)
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
  // Prefer the "Ausdruck" sheet; fall back to the first sheet so partial
  // exports without that exact name still work.
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
    // After the first k/w column the sheet repeats the header. SheetJS
    // disambiguates with " ", "_1", "_2" suffixes depending on version.
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
