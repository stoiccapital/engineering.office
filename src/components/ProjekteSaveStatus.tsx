import { useProjects } from '@/projects-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

export function ProjekteSaveStatus() {
  const status = useProjects((s) => s.status)
  const error = useProjects((s) => s.error)
  return <SaveIndicator status={status} error={error} />
}
