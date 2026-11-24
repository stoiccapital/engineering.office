import { useEffect, useState } from 'react'
import { CONFLICT_EVENT } from '@/api'
import { Button } from '@/components/ui/button'

// Shown when a save was refused because someone else changed the same data
// in the meantime (the refused copy is kept on the server, nothing is lost).
export function ConflictNotice() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onConflict = () => setOpen(true)
    window.addEventListener(CONFLICT_EVENT, onConflict)
    return () => window.removeEventListener(CONFLICT_EVENT, onConflict)
  }, [])

  if (!open) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-xl flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-lg">
        <span className="text-sm">
          <strong className="font-semibold">Nicht gespeichert:</strong> Jemand anderes hat diese Daten inzwischen
          geändert. Bitte neu laden und die letzte Änderung erneut vornehmen.
        </span>
        <Button size="sm" onClick={() => location.reload()}>
          Neu laden
        </Button>
      </div>
    </div>
  )
}
