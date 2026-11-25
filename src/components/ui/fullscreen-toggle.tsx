import { Maximize2, Minimize2 } from 'lucide-react'

export function FullscreenToggle({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean
  onToggle: () => void
}) {
  const label = isFullscreen ? 'Vollbild beenden' : 'Vollbild anzeigen'
  return (
    <button
      onClick={onToggle}
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {isFullscreen ? (
        <Minimize2 className="h-3.5 w-3.5" />
      ) : (
        <Maximize2 className="h-3.5 w-3.5" />
      )}
    </button>
  )
}
