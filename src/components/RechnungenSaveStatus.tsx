import { useRechnungen } from '@/rechnungen-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function RechnungenSaveStatus() {
  const status = useRechnungen((s) => s.status)
  const error = useRechnungen((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
