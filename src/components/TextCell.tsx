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
  // Read-only cells get a muted bg at rest so the eye can spot editability
  // instantly, without hovering first. Editable cells stay on the row bg
  // and reveal a stronger lift on focus.
  const interactive = readOnly
    ? 'bg-foreground/[0.03] text-muted-foreground'
    : 'bg-transparent transition-colors hover:bg-foreground/[0.05] focus:bg-foreground/[0.09]'

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
