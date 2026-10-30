import { useState } from 'react'
import { QuartalPlanTable } from '@/components/QuartalPlanTable'
import { TeamOverview } from '@/components/TeamOverview'
import { cn } from '@/lib/utils'
import { LayoutGrid, Users } from 'lucide-react'

type Tab = 'plan' | 'overview'

const TABS: ReadonlyArray<{ value: Tab; label: string; icon: typeof LayoutGrid }> = [
  { value: 'plan', label: 'Plan', icon: LayoutGrid },
  { value: 'overview', label: 'Übersicht', icon: Users },
]

export function PlanTabs() {
  const [tab, setTab] = useState<Tab>('plan')
  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-0.5 rounded-md border bg-card p-1">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.value
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>
      {tab === 'plan' ? <QuartalPlanTable /> : <TeamOverview />}
    </div>
  )
}
