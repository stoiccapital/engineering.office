import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Download, Upload, X } from 'lucide-react'
import { useForecast } from '@/store'
import { parseCSV, parseXLSX, buildTemplateCSV, type ParseResult } from '@/lib/import'
import type { ProjectRow } from '@/types'

type Phase = 'pick' | 'preview' | 'importing' | 'done' | 'error'

export function ImportDialog() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('pick')
  const [filename, setFilename] = useState<string>('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const year = useForecast((s) => s.year)
  const quarter = useForecast((s) => s.quarter)
  const period = useForecast((s) => s.period)
  const replaceRows = useForecast((s) => s.replaceRows)

  function reset() {
    setPhase('pick')
    setResult(null)
    setFilename('')
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFile(file: File) {
    setFilename(file.name)
    setError(null)
    try {
      const name = file.name.toLowerCase()
      let parsed: ParseResult
      if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
        parsed = parseCSV(await file.text())
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) {
        parsed = parseXLSX(await file.arrayBuffer())
      } else {
        throw new Error('Nur CSV und XLSX werden unterstützt')
      }
      if (parsed.rows.length === 0) {
        throw new Error(
          'Keine Zeilen erkannt. Prüfen Sie, dass die Kopfzeile die erwarteten Spalten enthält.',
        )
      }
      setResult(parsed)
      setPhase('preview')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  function confirmImport() {
    if (!result) return
    setPhase('importing')
    try {
      replaceRows(result.rows)
      setPhase('done')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCSV()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'forecast-vorlage.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentRowCount = period?.rows.length ?? 0

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent">
          <Upload className="h-3.5 w-3.5" />
          Importieren
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[min(90vw,640px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background shadow-xl">
          <div className="flex items-start justify-between border-b px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold">
                Forecast importieren
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                Importiert in <span className="font-mono font-semibold">{year} {quarter}</span>.
                Bestehende Zeilen ({currentRowCount}) werden überschrieben.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {phase === 'pick' && (
              <PickPhase
                inputRef={inputRef}
                onFile={handleFile}
                onTemplate={downloadTemplate}
              />
            )}
            {phase === 'preview' && result && (
              <PreviewPhase filename={filename} result={result} />
            )}
            {phase === 'importing' && (
              <div className="py-8 text-center text-sm text-muted-foreground">Importiere…</div>
            )}
            {phase === 'done' && result && (
              <div className="py-8 text-center">
                <div className="text-sm font-medium">Import abgeschlossen</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {result.rows.length} Zeilen übernommen und gespeichert.
                </div>
              </div>
            )}
            {phase === 'error' && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
            {phase === 'pick' && (
              <>
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV-Vorlage
                </button>
                <Dialog.Close className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent">
                  Abbrechen
                </Dialog.Close>
              </>
            )}
            {phase === 'preview' && result && (
              <>
                <button
                  onClick={reset}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                >
                  Andere Datei
                </button>
                <button
                  onClick={confirmImport}
                  className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
                >
                  {result.rows.length} Zeilen importieren
                </button>
              </>
            )}
            {(phase === 'importing' || phase === 'done') && (
              <Dialog.Close className="ml-auto rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent">
                Schließen
              </Dialog.Close>
            )}
            {phase === 'error' && (
              <button
                onClick={reset}
                className="ml-auto rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
              >
                Erneut versuchen
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PickPhase({
  inputRef,
  onFile,
  onTemplate,
}: {
  inputRef: React.RefObject<HTMLInputElement>
  onFile: (f: File) => void
  onTemplate: () => void
}) {
  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-foreground/40 hover:bg-accent/50">
        <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
        <div className="text-sm font-medium">CSV oder XLSX hochladen</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Klicken oder Datei hier ablegen
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
          }}
        />
      </label>

      <div className="rounded-md bg-muted/40 p-3 text-xs">
        <div className="mb-1.5 font-medium text-foreground">Erwartete Spalten</div>
        <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          projektleiter_de, projektleiter_pl, projektname, proj_nr, leistung,
          forecast_de, flag_de, forecast_pl, flag_pl, abgerechnet_de, abgerechnet_pl,
          leistungsstand_de, leistungsstand_pl
        </div>
        <button
          onClick={onTemplate}
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
        >
          <Download className="h-3 w-3" />
          CSV-Vorlage herunterladen
        </button>
      </div>
    </div>
  )
}

function PreviewPhase({ filename, result }: { filename: string; result: ParseResult }) {
  const preview: ProjectRow[] = result.rows.slice(0, 5)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
        <div>
          <span className="font-mono font-semibold">{filename}</span>
          <span className="ml-2 text-muted-foreground">
            {result.rows.length} Zeilen
            {result.skipped > 0 && `, ${result.skipped} übersprungen`}
          </span>
        </div>
      </div>

      {result.unknownHeaders.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Unbekannte Spalten werden ignoriert:{' '}
          <span className="font-mono">{result.unknownHeaders.join(', ')}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Proj. Nr.</th>
              <th className="px-2 py-1.5 text-left font-medium">Projektname</th>
              <th className="px-2 py-1.5 text-left font-medium">PL DE</th>
              <th className="px-2 py-1.5 text-right font-medium">Fc DE</th>
              <th className="px-2 py-1.5 text-right font-medium">Fc PL</th>
              <th className="px-2 py-1.5 text-right font-medium">Abg DE</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1 font-mono">{r.projNr}</td>
                <td className="max-w-[280px] truncate px-2 py-1">{r.projektname}</td>
                <td className="px-2 py-1">{r.projektleiterDE}</td>
                <td className="num px-2 py-1">{r.forecastDE ?? ''}</td>
                <td className="num px-2 py-1">{r.forecastPL ?? ''}</td>
                <td className="num px-2 py-1">{r.abgerechnetDE ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.rows.length > preview.length && (
        <div className="text-center text-xs text-muted-foreground">
          +{result.rows.length - preview.length} weitere Zeilen
        </div>
      )}
    </div>
  )
}
