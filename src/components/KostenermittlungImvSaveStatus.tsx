import { useImv } from '@/imv-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function KostenermittlungImvSaveStatus() {
  const status = useImv((s) => s.status)
  const error = useImv((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
