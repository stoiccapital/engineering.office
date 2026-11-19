import { useHr } from '@/hr-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function HrSaveStatus() {
  const status = useHr((s) => s.status)
  const error = useHr((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
