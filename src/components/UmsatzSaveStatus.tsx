import { useUmsatz } from '@/umsatz-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function UmsatzSaveStatus() {
  const status = useUmsatz((s) => s.status)
  const error = useUmsatz((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
