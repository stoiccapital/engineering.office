import { useKostenermittlung } from '@/kostenermittlung-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function KostenermittlungSaveStatus() {
  const status = useKostenermittlung((s) => s.status)
  const error = useKostenermittlung((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
