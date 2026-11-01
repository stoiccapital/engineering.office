import { useZiele } from '@/ziele-store'

export function ZieleSaveStatus() {
  const status = useZiele((s) => s.status)
  const error = useZiele((s) => s.error)

  const label =
    status === 'loading'
      ? 'Lädt…'
      : status === 'saving'
        ? 'Speichert…'
        : status === 'saved'
          ? 'Gespeichert'
          : status === 'error'
            ? `Fehler: ${error ?? ''}`
            : ''

  const tone =
    status === 'error'
      ? 'text-destructive'
      : status === 'saving' || status === 'loading'
        ? 'text-muted-foreground'
        : 'text-muted-foreground/60'

  return <span className={`text-xs tabular-nums ${tone}`}>{label}</span>
}
