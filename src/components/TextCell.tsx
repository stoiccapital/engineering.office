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
      <textarea
        rows={1}
        className={cn(
          base,
          interactive,
          'resize-none whitespace-pre-wrap break-words leading-snug',
          className,
        )}
        style={{ fieldSizing: 'content' } as React.CSSProperties}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
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
