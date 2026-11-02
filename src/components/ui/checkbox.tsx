import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'border-foreground bg-foreground text-background hover:bg-foreground/90'
          : 'border-muted-foreground/40 bg-background hover:border-foreground/60',
        className,
      )}
    >
      {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
    </button>
  )
}
