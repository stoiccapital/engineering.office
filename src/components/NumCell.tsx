import { useState, useEffect } from 'react'
import { fmtEUR, fmtPct, parseNum, parsePct } from '@/lib/format'
import { cn } from '@/lib/utils'

type Props = {
  value: number | null
  onChange?: (v: number | null) => void
  readOnly?: boolean
  pct?: boolean
  className?: string
  placeholder?: string
}

export function NumCell({ value, onChange, readOnly, pct, className, placeholder }: Props) {
  const display = pct ? fmtPct(value) : fmtEUR(value)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(display)

  useEffect(() => {
    if (!editing) setDraft(display)
  }, [display, editing])

  if (readOnly || !onChange) {
    return (
      <div
        className={cn(
          'num px-2 py-1.5 text-sm text-muted-foreground tabular-nums',
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
        'num w-full px-2 py-1.5 text-sm bg-transparent outline-none focus:bg-accent/60 rounded-sm',
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
