import { useEffect, useState } from 'react'
import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import { KPIStrip } from '@/components/KPIStrip'
import { ForecastTable } from '@/components/ForecastTable'
import { AuthGate } from '@/components/AuthGate'
import { SaveStatus } from '@/components/SaveStatus'
import { PlanSaveStatus } from '@/components/PlanSaveStatus'
import { YearSwitcher } from '@/components/YearSwitcher'
import { QuarterSwitcher } from '@/components/QuarterSwitcher'
import { PlanTabs } from '@/components/PlanTabs'
import { ImportDialog } from '@/components/ImportDialog'
import { Dashboard } from '@/components/Dashboard'
import { DashboardPeriodSwitcher } from '@/components/DashboardPeriodSwitcher'
import { LoadingCard } from '@/components/ui/loading-card'
import { Logo } from '@/components/Logo'
import { useForecast } from '@/store'
import { usePlan } from '@/plan-store'
import { clearToken } from '@/api'
import { cn } from '@/lib/utils'
import { CalendarDays, LayoutDashboard, LogOut, Table2 } from 'lucide-react'

type View = 'forecast' | 'plan' | 'dashboard'

const VIEW_META: Record<View, { title: string; label: string; icon: typeof Table2 }> = {
  forecast: { title: 'Forecast', label: 'Forecast', icon: Table2 },
  plan: { title: 'Quartalsplanung', label: 'Quartalsplanung', icon: CalendarDays },
  dashboard: { title: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
}

const VIEW_ORDER: View[] = ['dashboard', 'forecast', 'plan']

export default function App() {
  return (
    <AuthGate>
      <Shell />
    </AuthGate>
  )
}

function Shell() {
  const [view, setView] = useState<View>('forecast')
  const loadForecast = useForecast((s) => s.load)
  const period = useForecast((s) => s.period)
  const loadPlan = usePlan((s) => s.load)
  const plan = usePlan((s) => s.plan)

  useEffect(() => {
    void loadForecast()
  }, [loadForecast])

  useEffect(() => {
    if (view === 'plan' && !plan) void loadPlan()
  }, [view, plan, loadPlan])

  const meta = VIEW_META[view]

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar view={view} onSelect={setView} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-background">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Ingenieurbüro Merkin &amp; Völker
              </div>
              <h1 className="text-lg font-semibold">{meta.title}</h1>
            </div>
            <div className="flex items-center gap-4">
              {view === 'forecast' && <SaveStatus />}
              {view === 'plan' && <PlanSaveStatus />}
              {view === 'forecast' && <PeriodSwitcher />}
              {view === 'plan' && (
                <>
                  <QuarterSwitcher />
                  <YearSwitcher />
                </>
              )}
              {view === 'dashboard' && <DashboardPeriodSwitcher />}
              {view === 'forecast' && <ImportDialog />}
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-6 px-6 py-6">
          {view === 'forecast' &&
            (period ? (
              <>
                <KPIStrip />
                <ForecastTable />
              </>
            ) : (
              <LoadingCard>Lade Forecast…</LoadingCard>
            ))}
          {view === 'plan' &&
            (plan ? <PlanTabs /> : <LoadingCard>Lade Quartalsplanung…</LoadingCard>)}
          {view === 'dashboard' && <Dashboard />}
        </main>
      </div>
    </div>
  )
}

function Sidebar({
  view,
  onSelect,
}: {
  view: View
  onSelect: (v: View) => void
}) {
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r bg-background">
      <div className="space-y-3 border-b px-4 py-4">
        <Logo />
        <div className="text-sm font-semibold leading-tight">
          Ingenieurbüro
          <br />
          Merkin &amp; Völker
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {VIEW_ORDER.map((v) => (
          <NavItem
            key={v}
            icon={VIEW_META[v].icon}
            label={VIEW_META[v].label}
            active={v === view}
            onClick={() => onSelect(v)}
          />
        ))}
      </nav>

      <div className="border-t p-2">
        <button
          onClick={() => {
            clearToken()
            location.reload()
          }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Abmelden
        </button>
      </div>
    </aside>
  )
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Table2
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
