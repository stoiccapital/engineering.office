import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

export function TextCell({ value, onChange, placeholder, className }: Props) {
  return (
    <input
      className={cn(
        'w-full px-2 py-1.5 text-sm bg-transparent outline-none focus:bg-accent/60 rounded-sm',
        className,
      )}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
