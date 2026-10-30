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
  const interactive = readOnly ? '' : 'focus:bg-accent/60'

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
