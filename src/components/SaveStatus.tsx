import { useForecast } from '@/store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function SaveStatus() {
  const status = useForecast((s) => s.status)
  const error = useForecast((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
