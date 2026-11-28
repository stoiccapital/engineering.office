/**
 * The one visible toast for the undo queue. Mount once at the app root;
 * every destructive-but-reversible action across the app pushes to
 * src/undo-store.ts and this component picks it up.
 */
import { Undo2 } from 'lucide-react'
import { useEffect } from 'react'
import { useUndo } from '@/undo-store'

const TTL_MS = 5_000

export function UndoToast() {
  const current = useUndo((s) => s.current)
  const undo = useUndo((s) => s.undo)
  const dismiss = useUndo((s) => s.dismiss)

  // Auto-dismiss after TTL. The id in deps resets the timer on each new entry.
  useEffect(() => {
    if (!current) return
    const t = setTimeout(dismiss, TTL_MS)
    return () => clearTimeout(t)
  }, [current, dismiss])

  // Z+arrow keyboard: ⌘Z / Ctrl+Z triggers the undo while the toast is visible.
  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        // Only hijack if no input is focused — don't break text-editing undo.
        const t = document.activeElement as HTMLElement | null
        const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
        if (typing) return
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, undo])

  if (!current) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-xl">
        <span className="text-sm">{current.label}</span>
        <button
          type="button"
          onClick={undo}
          className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-xs font-medium hover:bg-accent"
          aria-label="Rückgängig"
        >
          <Undo2 className="h-3 w-3" />
          Rückgängig
          <span className="ml-1 font-mono text-[10px] text-muted-foreground">⌘Z</span>
        </button>
      </div>
    </div>
  )
}
