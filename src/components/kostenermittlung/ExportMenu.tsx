import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Download, FileSpreadsheet, FileText, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Choice = 'pdf' | 'xlsx' | 'csv'

export function ExportMenu({ onSelect }: { onSelect: (c: Choice) => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-1 h-3.5 w-3.5" /> Export
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-44 rounded-md border bg-card p-1 text-sm shadow-md focus:outline-none"
        >
          <Item icon={FileText} label="PDF" onSelect={() => onSelect('pdf')} />
          <Item
            icon={FileSpreadsheet}
            label="Excel (.xlsx)"
            onSelect={() => onSelect('xlsx')}
          />
          <Item icon={Table2} label="CSV" onSelect={() => onSelect('csv')} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function Item({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof FileText
  label: string
  onSelect: () => void
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none',
        'hover:bg-accent focus:bg-accent',
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
    </DropdownMenu.Item>
  )
}

export type ExportChoice = Choice
