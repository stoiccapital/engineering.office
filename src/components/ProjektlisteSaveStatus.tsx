import { useProjektliste } from '@/projektliste-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function ProjektlisteSaveStatus() {
  const status = useProjektliste((s) => s.status)
  const error = useProjektliste((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
