import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
  multiline?: boolean
}

export function TextCell({
  value,
  onChange,
  placeholder,
  className,
  readOnly,
  multiline,
}: Props) {
  const base = 'w-full px-2 py-1.5 text-sm outline-none rounded-sm'
  // Editable cells carry a subtle fill at rest so input slots are visible
  // at a glance: darker in light mode, lighter in dark mode. Read-only cells
  // stay flat — plain-text output.
  const interactive = readOnly
    ? 'bg-transparent text-muted-foreground'
    : 'bg-foreground/[0.03] transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]'

  if (multiline) {
    return (
      <MultilineTextCell
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cn(base, interactive, className)}
      />
    )
  }

  return (
    <input
      className={cn(base, interactive, className)}
      value={value}
      placeholder={placeholder}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// Auto-growing textarea. Starts as one row and expands to fit its content on
// every value change — including external updates (e.g. the Kostenermittlung
// katalog picker writing a long `text` field). Done in JS because the newer
// `field-sizing: content` CSS is Chromium-only; this pattern works in Safari
// and Firefox too.
function MultilineTextCell({
  value,
  onChange,
  placeholder,
  readOnly,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      className={cn(
        'resize-none whitespace-pre-wrap break-words leading-snug',
        className,
      )}
      value={value}
      placeholder={placeholder}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
