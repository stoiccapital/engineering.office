import { useZiele } from '@/ziele-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function ZieleSaveStatus() {
  const status = useZiele((s) => s.status)
  const error = useZiele((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
