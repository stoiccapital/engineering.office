import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'loading' | 'loaded' | 'saving' | 'saved' | 'error'

type Props = {
  status: Status
  error?: string | null
}

export function SaveIndicator({ status, error }: Props) {
  const [visible, setVisible] = useState<Status>(status)

  useEffect(() => {
    if (status === 'saved') {
      setVisible('saved')
      const t = setTimeout(() => setVisible('idle'), 2000)
      return () => clearTimeout(t)
    }
    setVisible(status)
  }, [status])

  if (visible === 'idle' || visible === 'loaded') return null

  const label =
    visible === 'loading'
      ? 'Lädt'
      : visible === 'saving'
        ? 'Speichert'
        : visible === 'saved'
          ? 'Gespeichert'
          : visible === 'error'
            ? error || 'Fehler'
            : ''

  const dot =
    visible === 'error'
      ? 'bg-destructive'
      : visible === 'saved'
        ? 'bg-emerald-500'
        : 'bg-muted-foreground/60 animate-pulse'

  const tone = visible === 'error' ? 'text-destructive' : 'text-muted-foreground'

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs tabular-nums', tone)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  )
}
