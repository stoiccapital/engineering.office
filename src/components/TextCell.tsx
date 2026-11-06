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
  const base = 'w-full px-2 py-1.5 text-sm bg-transparent outline-none rounded-sm'
  // Editable cells show a subtle hover lift + stronger focus — the chrome
  // only appears when you interact with it. Read-only cells stay flat so
  // scanning past them is effortless.
  const interactive = readOnly
    ? ''
    : 'transition-colors hover:bg-foreground/[0.05] focus:bg-foreground/[0.09]'

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
