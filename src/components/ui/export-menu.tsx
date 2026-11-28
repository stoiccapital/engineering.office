/**
 * "Exportieren" dropdown — one primitive for every tabular view.
 * Two choices: Excel (.xlsx) and CSV. Caller supplies the builder functions
 * so we don't pre-compute heavy data unless the user actually clicks.
 */
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { exportCsv, exportXlsx, type ExportRow, type ExportSheet } from '@/lib/export'
import { cn } from '@/lib/utils'

export function ExportMenu({
  filename,
  buildSheets,
  disabled,
  className,
}: {
  /** Without extension — `.xlsx` / `.csv` appended. */
  filename: string
  /** Lazy — only called on click. */
  buildSheets: () => ExportSheet[]
  disabled?: boolean
  className?: string
}) {
  const onExcel = () => {
    const sheets = buildSheets()
    if (sheets.length === 0 || sheets[0].rows.length === 0) return
    exportXlsx({ filename, sheets })
  }
  const onCsv = () => {
    const sheets = buildSheets()
    const first = sheets[0]
    if (!first || first.rows.length === 0) return
    exportCsv({ filename, rows: first.rows, columnOrder: first.columnOrder })
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="Exportieren"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <Download className="h-3.5 w-3.5" />
          Exportieren
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 w-40 rounded-md border bg-card p-1 focus:outline-none"
        >
          <DropdownMenu.Item
            onSelect={onExcel}
            className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
          >
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            Excel (.xlsx)
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onCsv}
            className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            CSV
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export type { ExportRow, ExportSheet }
