import { Eye, X } from 'lucide-react'
import { useAccess } from '@/access-store'

export function ViewAsBanner() {
  const viewAsRoleId = useAccess((s) => s.viewAsRoleId)
  const currentRole = useAccess((s) => s.currentRole)
  const realRole = useAccess((s) => s.realRole)
  const setViewAsRole = useAccess((s) => s.setViewAsRole)

  if (!viewAsRoleId || !currentRole) return null

  return (
    <div className="flex items-center justify-between gap-3 border-b bg-warning-soft px-6 py-2 text-xs text-warning">
      <div className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5" />
        <span>
          Ansicht als{' '}
          <span className="font-semibold">{currentRole.name}</span>
          {realRole && (
            <>
              {' · '}
              <span className="opacity-70">
                Deine echte Rolle: {realRole.name}
              </span>
            </>
          )}
          {' · '}
          <span className="opacity-70">
            Schreiben läuft weiterhin unter deiner echten Rolle
          </span>
        </span>
      </div>
      <button
        onClick={() => setViewAsRole(null)}
        className="inline-flex items-center gap-1 rounded bg-background/40 px-2 py-0.5 font-medium hover:bg-background/60"
      >
        <X className="h-3 w-3" />
        Zurück zur eigenen Rolle
      </button>
    </div>
  )
}
