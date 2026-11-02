import { usePlan } from '@/plan-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function PlanSaveStatus() {
  const status = usePlan((s) => s.status)
  const error = usePlan((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
