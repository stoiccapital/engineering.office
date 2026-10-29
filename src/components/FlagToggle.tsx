import type { RiskFlag } from '@/types'
import { cn } from '@/lib/utils'

type Props = {
  value: RiskFlag
  onChange: (v: RiskFlag) => void
  compact?: boolean
}

export function FlagToggle({ value, onChange, compact }: Props) {
  const next: RiskFlag = value === 'k' ? 'w' : 'k'
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={value === 'k' ? 'kritisch — klick für wahrscheinlich' : 'wahrscheinlich — klick für kritisch'}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-mono text-xs font-semibold transition-colors',
        compact ? 'h-6 w-6' : 'h-7 w-8',
        value === 'k'
          ? 'bg-destructive/10 text-destructive hover:bg-accent'
          : 'bg-muted text-muted-foreground hover:bg-accent',
      )}
    >
      {value}
    </button>
  )
}
