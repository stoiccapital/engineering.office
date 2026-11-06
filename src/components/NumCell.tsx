import { useState, useEffect } from 'react'
import { fmtDecimal, fmtEUR, fmtPct, parseNum, parsePct } from '@/lib/format'
import { cn } from '@/lib/utils'

type Props = {
  value: number | null
  onChange?: (v: number | null) => void
  readOnly?: boolean
  pct?: boolean
  decimals?: number
  className?: string
  placeholder?: string
}

export function NumCell({ value, onChange, readOnly, pct, decimals, className, placeholder }: Props) {
  const display = pct
    ? fmtPct(value)
    : decimals !== undefined
      ? fmtDecimal(value, decimals)
      : fmtEUR(value)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(display)

  useEffect(() => {
    if (!editing) setDraft(display)
  }, [display, editing])

  if (readOnly || !onChange) {
    // No chrome, no hover: derived / computed values look flat so the eye
    // learns to skip them while scanning for inputs.
    return (
      <div
        className={cn(
          'num px-2 py-1.5 text-sm text-muted-foreground',
          className,
        )}
      >
        {display || <span className="text-muted-foreground/40">—</span>}
      </div>
    )
  }

  return (
    <input
      className={cn(
        'num w-full px-2 py-1.5 text-sm bg-transparent outline-none rounded-sm transition-colors hover:bg-accent/40 focus:bg-accent/60',
        className,
      )}
      value={editing ? draft : display}
      placeholder={placeholder}
      onFocus={(e) => {
        setEditing(true)
        setDraft(value === null ? '' : String(value).replace('.', ','))
        requestAnimationFrame(() => e.target.select())
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false)
        const parsed = pct ? parsePct(draft) : parseNum(draft)
        if (parsed !== value) onChange(parsed)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setDraft(display)
          setEditing(false)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}
