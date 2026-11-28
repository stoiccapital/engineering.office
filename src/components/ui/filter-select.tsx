/**
 * Shared filter dropdown for any "All / pick one" selector in a toolbar.
 * Replaces the hand-rolled <select> clones in ForecastTable and Rechnungen
 * (PM filter) and Projektliste (Status filter). Same visual, same behavior.
 *
 * See docs/principles.md §1: one primitive per job. If a future filter
 * doesn't fit here, extend this instead of forking.
 */
import { cn } from '@/lib/utils'

export type FilterOption = string | { value: string; label: string }

export function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  allValue = 'all',
  title,
  className,
  ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  options: readonly FilterOption[]
  /** First option label when no filter is applied. */
  allLabel: string
  /** The value the first option carries. Defaults to 'all' (used by PM
   *  filters); some filters (Projektliste status) use '' instead. */
  allValue?: string
  title?: string
  className?: string
  ariaLabel?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
      aria-label={ariaLabel ?? allLabel}
      className={cn(
        'h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus:ring-1 focus:ring-ring',
        className,
      )}
    >
      <option value={allValue}>{allLabel}</option>
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value
        const l = typeof opt === 'string' ? opt : opt.label
        return (
          <option key={v} value={v}>
            {l}
          </option>
        )
      })}
    </select>
  )
}
