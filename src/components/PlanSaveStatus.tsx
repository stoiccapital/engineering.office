import { usePlan } from '@/plan-store'

export function PlanSaveStatus() {
  const status = usePlan((s) => s.status)
  const error = usePlan((s) => s.error)

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
