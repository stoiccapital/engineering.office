import { useEffect, useState } from 'react'
import { KPIStrip } from '@/components/KPIStrip'
import { ForecastTable } from '@/components/ForecastTable'
import { AuthGate } from '@/components/AuthGate'
import { SaveStatus } from '@/components/SaveStatus'
import { PlanSaveStatus } from '@/components/PlanSaveStatus'
import { ZieleSaveStatus } from '@/components/ZieleSaveStatus'
import { UmsatzSaveStatus } from '@/components/UmsatzSaveStatus'
import { PlanTabs } from '@/components/PlanTabs'
import { ImportDialog } from '@/components/ImportDialog'
import { Dashboard } from '@/components/Dashboard'
import { Ziele } from '@/components/Ziele'
import { Umsatzkontrolle } from '@/components/Umsatzkontrolle'
import { PeriodPicker, type Quarter, type QuarterOrAll } from '@/components/ui/period-picker'
import { useDashboard } from '@/dashboard-store'
import { LoadingCard } from '@/components/ui/loading-card'
import { Logo } from '@/components/Logo'
import { useForecast } from '@/store'
import { usePlan } from '@/plan-store'
import { useZiele } from '@/ziele-store'
import { useUmsatz } from '@/umsatz-store'
import { clearToken } from '@/api'
import { cn } from '@/lib/utils'
import { Briefcase, CalendarDays, ChevronDown, ChevronRight, Gauge, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Table2, Target } from 'lucide-react'

const SIDEBAR_COLLAPSED_KEY = 'eo:sidebarCollapsed'
const OPERATIVE_EXPANDED_KEY = 'eo:operativeExpanded'

type View = 'forecast' | 'plan' | 'dashboard' | 'ziele' | 'umsatz'

const VIEW_META: Record<View, { title: string; label: string; icon: typeof Table2 }> = {
  forecast: { title: 'Forecast', label: 'Forecast', icon: Table2 },
  plan: { title: 'Quartalsplanung', label: 'Quartalsplanung', icon: CalendarDays },
  dashboard: { title: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ziele: { title: 'Ziele', label: 'Ziele', icon: Target },
  umsatz: { title: 'Zielkontrolle', label: 'Zielkontrolle', icon: Gauge },
}

type NavEntry =
  | { kind: 'leaf'; view: View }
  | { kind: 'group'; id: string; label: string; icon: typeof Table2; children: View[] }

const NAV: NavEntry[] = [
  { kind: 'leaf', view: 'ziele' },
  {
    kind: 'group',
    id: 'operative',
    label: 'Operative Planung',
    icon: Briefcase,
    children: ['dashboard', 'forecast', 'plan'],
  },
  { kind: 'leaf', view: 'umsatz' },
]

export default function App() {
  return (
    <AuthGate>
      <Shell />
    </AuthGate>
  )
}

function Shell() {
  const [view, setView] = useState<View>('forecast')
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1',
  )
  const [operativeExpanded, setOperativeExpanded] = useState<boolean>(
    () => localStorage.getItem(OPERATIVE_EXPANDED_KEY) !== '0',
  )
  const loadForecast = useForecast((s) => s.load)
  const period = useForecast((s) => s.period)
  const loadPlan = usePlan((s) => s.load)
  const plan = usePlan((s) => s.plan)
  const loadZiele = useZiele((s) => s.load)
  const ziele = useZiele((s) => s.ziele)
  const loadUmsatz = useUmsatz((s) => s.load)
  const umsatz = useUmsatz((s) => s.data)

  useEffect(() => {
    void loadForecast()
  }, [loadForecast])

  useEffect(() => {
    if (view === 'plan' && !plan) void loadPlan()
  }, [view, plan, loadPlan])

  useEffect(() => {
    if (view === 'ziele' && !ziele) void loadZiele()
  }, [view, ziele, loadZiele])

  useEffect(() => {
    if (view === 'umsatz' && !umsatz) void loadUmsatz()
  }, [view, umsatz, loadUmsatz])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    localStorage.setItem(OPERATIVE_EXPANDED_KEY, operativeExpanded ? '1' : '0')
  }, [operativeExpanded])

  const meta = VIEW_META[view]

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar
        view={view}
        onSelect={setView}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        operativeExpanded={operativeExpanded}
        onToggleOperative={() => setOperativeExpanded((v) => !v)}
      />

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
              {view === 'ziele' && <ZieleSaveStatus />}
              {view === 'umsatz' && <UmsatzSaveStatus />}
              <ViewPeriodPicker view={view} />
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
          {view === 'ziele' && <Ziele />}
          {view === 'umsatz' && <Umsatzkontrolle />}
        </main>
      </div>
    </div>
  )
}

function Sidebar({
  view,
  onSelect,
  collapsed,
  onToggleCollapsed,
  operativeExpanded,
  onToggleOperative,
}: {
  view: View
  onSelect: (v: View) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  operativeExpanded: boolean
  onToggleOperative: () => void
}) {
  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col border-r bg-background transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <div
        className={cn(
          'flex items-center border-b',
          collapsed ? 'justify-center px-2 py-4' : 'justify-between gap-2 px-4 py-4',
        )}
      >
        {collapsed ? (
          <Logo />
        ) : (
          <div className="min-w-0 space-y-3">
            <Logo />
            <div className="text-sm font-semibold leading-tight">
              Ingenieurbüro
              <br />
              Merkin &amp; Völker
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map((entry) => {
          if (entry.kind === 'leaf') {
            return (
              <NavItem
                key={entry.view}
                icon={VIEW_META[entry.view].icon}
                label={VIEW_META[entry.view].label}
                active={entry.view === view}
                collapsed={collapsed}
                onClick={() => onSelect(entry.view)}
              />
            )
          }
          const childActive = entry.children.includes(view)
          const expanded = operativeExpanded || collapsed
          return (
            <div key={entry.id}>
              <NavGroupHeader
                icon={entry.icon}
                label={entry.label}
                expanded={expanded}
                collapsed={collapsed}
                childActive={childActive}
                onToggle={onToggleOperative}
              />
              {expanded &&
                entry.children.map((childView) => (
                  <NavItem
                    key={childView}
                    icon={VIEW_META[childView].icon}
                    label={VIEW_META[childView].label}
                    active={childView === view}
                    collapsed={collapsed}
                    nested={!collapsed}
                    onClick={() => onSelect(childView)}
                  />
                ))}
            </div>
          )
        })}
      </nav>

      <div className="space-y-0.5 border-t p-2">
        <button
          onClick={onToggleCollapsed}
          title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
          className={cn(
            'flex w-full items-center gap-2 rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            collapsed ? 'justify-center px-2' : 'px-3',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              Einklappen
            </>
          )}
        </button>
        <button
          onClick={() => {
            clearToken()
            location.reload()
          }}
          title={collapsed ? 'Abmelden' : undefined}
          className={cn(
            'flex w-full items-center gap-2 rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            collapsed ? 'justify-center px-2' : 'px-3',
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && 'Abmelden'}
        </button>
      </div>
    </aside>
  )
}

function ViewPeriodPicker({ view }: { view: View }) {
  switch (view) {
    case 'ziele':
      return <ZielePicker />
    case 'dashboard':
      return <DashboardPicker />
    case 'forecast':
      return <ForecastPicker />
    case 'plan':
      return <PlanPicker />
    case 'umsatz':
      return <UmsatzPicker />
  }
}

function ZielePicker() {
  const year = useZiele((s) => s.year)
  const setYear = useZiele((s) => s.setYear)
  return <PeriodPicker year={year} onYearChange={setYear} />
}

function DashboardPicker() {
  const year = useDashboard((s) => s.year)
  const quarter = useDashboard((s) => s.quarter)
  const setYear = useDashboard((s) => s.setYear)
  const setQuarter = useDashboard((s) => s.setQuarter)
  return (
    <PeriodPicker
      year={year}
      onYearChange={setYear}
      quarter={quarter}
      onQuarterChange={(q) => setQuarter(q as Quarter)}
      includeJahr={false}
    />
  )
}

function ForecastPicker() {
  const year = useForecast((s) => s.year)
  const quarter = useForecast((s) => s.quarter)
  const setYear = useForecast((s) => s.setYear)
  const setQuarter = useForecast((s) => s.setQuarter)
  return (
    <PeriodPicker
      year={year}
      onYearChange={setYear}
      quarter={quarter}
      onQuarterChange={(q) => setQuarter(q as Quarter)}
      includeJahr={false}
    />
  )
}

function PlanPicker() {
  const year = usePlan((s) => s.year)
  const quarter = usePlan((s) => s.quarter)
  const setYear = usePlan((s) => s.setYear)
  const setQuarter = usePlan((s) => s.setQuarter)
  return (
    <PeriodPicker
      year={year}
      onYearChange={setYear}
      quarter={quarter as QuarterOrAll}
      onQuarterChange={(q) => setQuarter(q === 'all' ? 'all' : (q as Quarter))}
    />
  )
}

function UmsatzPicker() {
  const year = useUmsatz((s) => s.year)
  const quarter = useUmsatz((s) => s.quarter)
  const setYear = useUmsatz((s) => s.setYear)
  const setQuarter = useUmsatz((s) => s.setQuarter)
  return (
    <PeriodPicker
      year={year}
      onYearChange={setYear}
      quarter={quarter}
      onQuarterChange={setQuarter}
    />
  )
}

function NavItem({
  icon: Icon,
  label,
  active,
  collapsed,
  nested,
  onClick,
}: {
  icon: typeof Table2
  label: string
  active: boolean
  collapsed: boolean
  nested?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
        collapsed ? 'justify-center px-2' : nested ? 'pl-7 pr-3' : 'px-3',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {!collapsed && label}
    </button>
  )
}

function NavGroupHeader({
  icon: Icon,
  label,
  expanded,
  collapsed,
  childActive,
  onToggle,
}: {
  icon: typeof Table2
  label: string
  expanded: boolean
  collapsed: boolean
  childActive: boolean
  onToggle: () => void
}) {
  if (collapsed) {
    return (
      <div
        title={label}
        className={cn(
          'flex w-full items-center justify-center rounded-md px-2 py-2 text-sm font-medium',
          childActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
    )
  }
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        childActive ? 'text-foreground' : 'text-muted-foreground',
        'hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-left">{label}</span>
      {expanded ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
    </button>
  )
}
