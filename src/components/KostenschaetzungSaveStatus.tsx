import { useKostenschaetzung } from '@/kostenschaetzung-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function KostenschaetzungSaveStatus() {
  const status = useKostenschaetzung((s) => s.status)
  const error = useKostenschaetzung((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
