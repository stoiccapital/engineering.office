import * as Tooltip from '@radix-ui/react-tooltip'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  children: React.ReactNode
  className?: string
}

export function InfoTooltip({ children, className }: Props) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              className,
            )}
            aria-label="Legende anzeigen"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            align="end"
            sideOffset={6}
            className="z-50 max-w-xs rounded-md border bg-card p-3 text-xs text-foreground shadow-md"
          >
            {children}
            <Tooltip.Arrow className="fill-card" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
