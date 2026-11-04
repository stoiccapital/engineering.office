import { Circle, CircleDot } from 'lucide-react'
import type { TodoState } from '@/types'
import { cn } from '@/lib/utils'

// Display-only status indicator. State is derived from progress upstream:
// progress 0 (or null) → Offen, 0 < progress < 100 → In Bearbeitung,
// progress = 100 → todo is marked erledigt and filtered from Übersicht.
export function StateCycle({ state }: { state: TodoState }) {
  const Icon = state === 'inProgress' ? CircleDot : Circle
  const title = state === 'inProgress' ? 'In Bearbeitung' : 'Offen'
  return (
    <span
      aria-label={title}
      title={title}
      className={cn(
        'mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded',
        state === 'inProgress' ? 'text-amber-600' : 'text-muted-foreground/60',
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={state === 'offen' ? 1.5 : 2} />
    </span>
  )
}
