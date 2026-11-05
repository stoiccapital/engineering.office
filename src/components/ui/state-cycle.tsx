import { CheckCircle2, Circle, CircleDot, Hourglass } from 'lucide-react'
import { TODO_STATE_LABELS, type TodoState } from '@/types'
import { cn } from '@/lib/utils'

// Display-only status indicator for a todo.
// 'offen' → empty circle; 'inProgress' → filled dot; 'zurFreigabe' → hourglass;
// 'erledigt' → check (filtered out of Übersicht so rarely rendered).
export function StateCycle({ state }: { state: TodoState }) {
  const Icon =
    state === 'erledigt'
      ? CheckCircle2
      : state === 'zurFreigabe'
        ? Hourglass
        : state === 'inProgress'
          ? CircleDot
          : Circle
  const tone =
    state === 'erledigt'
      ? 'text-emerald-600'
      : state === 'zurFreigabe'
        ? 'text-violet-600'
        : state === 'inProgress'
          ? 'text-amber-600'
          : 'text-muted-foreground/60'
  const title = TODO_STATE_LABELS[state]
  return (
    <span
      aria-label={title}
      title={title}
      className={cn('mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded', tone)}
    >
      <Icon className="h-4 w-4" strokeWidth={state === 'offen' ? 1.5 : 2} />
    </span>
  )
}
