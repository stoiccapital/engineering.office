import { useEffect, useMemo, useRef, useState } from 'react'
import { KPIStrip } from '@/components/KPIStrip'
import { ForecastTable } from '@/components/ForecastTable'
import { SaveStatus } from '@/components/SaveStatus'
import { PlanSaveStatus } from '@/components/PlanSaveStatus'
import { ZieleSaveStatus } from '@/components/ZieleSaveStatus'
import { UmsatzSaveStatus } from '@/components/UmsatzSaveStatus'
import { RechnungenSaveStatus } from '@/components/RechnungenSaveStatus'
import { PlanTabs } from '@/components/PlanTabs'
import { Freigaben } from '@/components/Freigaben'
import { ImportDialog } from '@/components/ImportDialog'
import { Dashboard } from '@/components/Dashboard'
import { ZieleDashboardPage, ZieleTeamsPage } from '@/components/Ziele'
import { Umsatzkontrolle } from '@/components/Umsatzkontrolle'
import { Rechnungen } from '@/components/Rechnungen'
import { Mitarbeiter } from '@/components/Mitarbeiter'
import { Settings } from '@/components/Settings'
import { BauwerkeTab } from '@/components/kostenschaetzung/BauwerkeTab'
import { HoaiTab } from '@/components/kostenschaetzung/HoaiTab'
import { KatalogTab } from '@/components/kostenschaetzung/KatalogTab'
import { KostenschaetzungSaveStatus } from '@/components/KostenschaetzungSaveStatus'
import { PositionenTab as KePositionenTab } from '@/components/kostenermittlung/PositionenTab'
import { UebersichtTab as KeUebersichtTab } from '@/components/kostenermittlung/UebersichtTab'
import { DatenbankTab as KeDatenbankTab } from '@/components/kostenermittlung/DatenbankTab'
import { ProjectPicker as KeProjectPicker } from '@/components/kostenermittlung/ProjectPicker'
import { KostenermittlungSaveStatus } from '@/components/KostenermittlungSaveStatus'
import { ZeiterfassungTab as HrZeiterfassungTab } from '@/components/hr/ZeiterfassungTab'
import { GespraecheTab as HrGespraecheTab } from '@/components/hr/GespraecheTab'
import { HrSaveStatus } from '@/components/HrSaveStatus'
import { Aktivitaet } from '@/components/Aktivitaet'
import { Projektliste } from '@/components/Projektliste'
import { ProjektlisteSaveStatus } from '@/components/ProjektlisteSaveStatus'
import { useProjektliste } from '@/projektliste-store'
import { logActivity } from '@/activity-store'
import { AuthScreen, AwaitingApproval } from '@/components/AuthScreen'
import { ConflictNotice } from '@/components/ConflictNotice'
import { PeriodPicker, type HalbjahrOrAll, type Quarter, type QuarterOrAll } from '@/components/ui/period-picker'
import { UserMenu } from '@/components/ui/user-menu'
import { ViewAsBanner } from '@/components/ui/view-as-banner'
import { CommandPalette } from '@/components/ui/command-palette'
import { useDashboard } from '@/dashboard-store'
import { LoadingCard } from '@/components/ui/loading-card'
import { useForecast } from '@/store'
import { usePlan } from '@/plan-store'
import { useZiele } from '@/ziele-store'
import { useUmsatz } from '@/umsatz-store'
import { useRechnungen } from '@/rechnungen-store'
import { useRoster } from '@/roster-store'
import { useKostenschaetzung } from '@/kostenschaetzung-store'
import { useKostenermittlung } from '@/kostenermittlung-store'
import { useImv } from '@/imv-store'
import { KostenermittlungImvSaveStatus } from '@/components/KostenermittlungImvSaveStatus'
import { useHr } from '@/hr-store'
import { useAccess, allowedModules } from '@/access-store'
import type { ModuleId } from '@/types'
import { cn } from '@/lib/utils'
import { Activity, Briefcase, Building2, Calculator, CalendarDays, CheckSquare, ChevronDown, ChevronRight, Clock, Database, FileSpreadsheet, FileText, FolderKanban, Gauge, LayoutDashboard, ListTree, MessageSquare, PanelLeftClose, PanelLeftOpen, Receipt, Ruler, Settings as SettingsIcon, Table2, Target, UserCog, Users } from 'lucide-react'

const SIDEBAR_COLLAPSED_KEY = 'eo:sidebarCollapsed'
// Accordion mode — at most one sidebar group is expanded at a time.
const ACTIVE_GROUP_KEY = 'eo:activeGroup'
const VIEW_KEY = 'eo:view'

// plan_overview isn't a separate nav entry — it collapses into 'plan' view
// but with the overview-only tab inside PlanTabs.
// 'freigaben' is a virtual view gated by the 'plan' module (any PM-capable role).
// 'ks_*' are virtual views under the 'kostenschaetzung' module; access is coarse
// (if a role has 'kostenschaetzung', all four children are visible).
type View =
  | Exclude<ModuleId, 'plan_overview' | 'kostenschaetzung' | 'ziele' | 'umsatz' | 'hr_team_view'>
  | 'freigaben'
  | 'ks_bauwerke'
  | 'ks_hoai'
  | 'ks_katalog'
  | 'ke_positionen'
  | 'ke_uebersicht'
  | 'ke_datenbank'
  | 'ke_imv_uebersicht'
  | 'ke_imv_projekte'
  | 'ke_imv_ril'
  | 'ke_imv_free'
  | 'ke_imv_entry'
  | 'ke_imv_indices'
  | 'hr_zeiterfassung'
  | 'hr_gespraeche'
  | 'ziele_dashboard'
  | 'ziele_teams'
  | 'ziele_kontrolle'
  | 'aktivitaet'

const KS_VIEWS: View[] = ['ks_bauwerke', 'ks_hoai', 'ks_katalog']
const KE_VIEWS: View[] = ['ke_positionen', 'ke_uebersicht', 'ke_datenbank']
const KE_IMV_VIEWS: View[] = [
  'ke_imv_uebersicht',
  'ke_imv_projekte',
  'ke_imv_ril',
  'ke_imv_free',
  'ke_imv_entry',
  'ke_imv_indices',
]
const HR_VIEWS: View[] = ['hr_zeiterfassung', 'hr_gespraeche']
const ZIELE_VIEWS: View[] = ['ziele_dashboard', 'ziele_teams', 'ziele_kontrolle']

const VIEW_META: Record<View, { title: string; label: string; icon: typeof Table2 }> = {
  forecast: { title: 'Forecast', label: 'Forecast', icon: Table2 },
  plan: { title: 'Quartalsplanung', label: 'Quartalsplanung', icon: CalendarDays },
  freigaben: { title: 'Freigaben', label: 'Freigaben', icon: CheckSquare },
  dashboard: { title: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ziele_dashboard: { title: 'Ziele · Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ziele_teams: { title: 'Ziele · Teams', label: 'Teams', icon: Users },
  ziele_kontrolle: { title: 'Ziele · Zielkontrolle', label: 'Zielkontrolle', icon: Gauge },
  rechnungen: { title: 'Rechnungen', label: 'Rechnungen', icon: FileText },
  projektliste: { title: 'Projektliste', label: 'Projektliste', icon: FolderKanban },
  ks_bauwerke: { title: 'Bauwerke', label: 'Bauwerke', icon: Building2 },
  ks_hoai: { title: 'HOAI-Honorar', label: 'HOAI-Honorar', icon: Calculator },
  ks_katalog: { title: 'Datenbank · Ril 808', label: 'Datenbank Ril 808', icon: Database },
  ke_positionen: { title: 'Kostenermittlung · Projekte', label: 'Projekte', icon: ListTree },
  ke_uebersicht: { title: 'Kostenermittlung · Übersicht', label: 'Übersicht', icon: Receipt },
  ke_datenbank: { title: 'Kostenermittlung · Datenbank Ril 808', label: 'Datenbank Ril 808', icon: Database },
  ke_imv_uebersicht: { title: 'Kostenermittlung IMV · Übersicht', label: 'Übersicht', icon: LayoutDashboard },
  ke_imv_projekte: { title: 'Kostenermittlung IMV · Kostenermittlungen', label: 'Kostenermittlungen', icon: ListTree },
  ke_imv_ril: { title: 'Kostenermittlung IMV · Datenbank Ril 808', label: 'Datenbank Ril 808', icon: Database },
  ke_imv_free: { title: 'Kostenermittlung IMV · Freie Einheitspreise', label: 'Freie Einheitspreise', icon: Database },
  ke_imv_entry: { title: 'Kostenermittlung IMV · Kostenkennwert hinzufügen', label: 'Kostenkennwert hinzufügen', icon: FileSpreadsheet },
  ke_imv_indices: { title: 'Kostenermittlung IMV · Preisindizes', label: 'Preisindizes', icon: Gauge },
  hr_zeiterfassung: { title: 'HR · Zeiterfassung', label: 'Zeiterfassung', icon: Clock },
  hr_gespraeche: { title: 'HR · Gespräche', label: 'Gespräche', icon: MessageSquare },
  mitarbeiter: { title: 'Mitarbeiter', label: 'Mitarbeiter', icon: Users },
  settings: { title: 'Rollen', label: 'Rollen', icon: SettingsIcon },
  aktivitaet: { title: 'Aktivität', label: 'Aktivität', icon: Activity },
}

type NavEntry =
  | { kind: 'leaf'; view: View }
  | { kind: 'group'; id: string; label: string; icon: typeof Table2; children: View[] }

const NAV: NavEntry[] = [
  {
    kind: 'group',
    id: 'ziele',
    label: 'Ziele',
    icon: Target,
    children: ZIELE_VIEWS,
  },
  {
    kind: 'group',
    id: 'operative',
    label: 'Operative Planung',
    icon: Briefcase,
    children: ['dashboard', 'forecast', 'plan', 'freigaben'],
  },
  { kind: 'leaf', view: 'rechnungen' },
  { kind: 'leaf', view: 'projektliste' },
  {
    kind: 'group',
    id: 'kostenschaetzung',
    label: 'Kostenschätzung',
    icon: Ruler,
    children: KS_VIEWS,
  },
  {
    kind: 'group',
    id: 'kostenermittlung',
    label: 'Kostenermittlung',
    icon: FileSpreadsheet,
    children: KE_VIEWS,
  },
  {
    kind: 'group',
    id: 'kostenermittlung_imv',
    label: 'Kostenermittlung IMV',
    icon: FileSpreadsheet,
    children: KE_IMV_VIEWS,
  },
  {
    kind: 'group',
    id: 'hr',
    label: 'HR',
    icon: UserCog,
    children: HR_VIEWS,
  },
  {
    kind: 'group',
    id: 'einstellungen',
    label: 'Einstellungen',
    icon: SettingsIcon,
    children: ['mitarbeiter', 'settings', 'aktivitaet'],
  },
]

// Virtual views (ks_*, ziele_*, freigaben, aktivitaet) don't correspond to a
// ModuleId directly. Map them back to the most meaningful module for the
// activity log so admins see e.g. "Kostenschätzung" rather than "ks_bauwerke".
function viewToModule(view: View): ModuleId | null {
  if (view === 'freigaben') return 'plan'
  if (view === 'aktivitaet') return 'settings'
  // Every other View now maps 1:1 to a ModuleId after the ziele/umsatz/
  // kostenschaetzung split.
  return view as ModuleId
}

function filterNav(entries: NavEntry[], allowed: Set<View>): NavEntry[] {
  const out: NavEntry[] = []
  for (const e of entries) {
    if (e.kind === 'leaf') {
      if (allowed.has(e.view)) out.push(e)
    } else {
      const children = e.children.filter((c) => allowed.has(c))
      if (children.length) out.push({ ...e, children })
    }
  }
  return out
}

export default function App() {
  return (
    <AccessGate>
      <Shell />
      <ConflictNotice />
    </AccessGate>
  )
}

function AccessGate({ children }: { children: React.ReactNode }) {
  const status = useAccess((s) => s.status)
  const load = useAccess((s) => s.load)
  const currentRole = useAccess((s) => s.currentRole)
  const awaitingRole = useAccess((s) => s.awaitingRole)

  useEffect(() => {
    if (status === 'idle') void load()
  }, [status, load])

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Lade…
      </div>
    )
  }

  if (awaitingRole) return <AwaitingApproval />
  if (!currentRole) return <AuthScreen />
  return <>{children}</>
}

function Shell() {
  const currentRole = useAccess((s) => s.currentRole)
  const allowed = useMemo(() => {
    const base = allowedModules(currentRole)
    const views = new Set<View>()
    for (const m of base) {
      // 'plan_overview' grants the Plan sidebar entry (read-only Übersicht).
      if (m === 'plan_overview') views.add('plan')
      // Every other ModuleId maps 1:1 to a View now that ziele / umsatz /
      // kostenschaetzung have been split into their sub-module IDs.
      else views.add(m as View)
    }
    // Any role with full 'plan' edit access can validate submissions.
    if (base.has('plan')) views.add('freigaben')
    // Activity log is admin-gated via the 'settings' module.
    if (base.has('settings')) views.add('aktivitaet')
    // Projektliste is a shared controlling view — same open-access rule
    // so legacy roles don't need to be reconfigured on the server.
    views.add('projektliste')
    return views
  }, [currentRole])
  const nav = useMemo(() => filterNav(NAV, allowed), [allowed])

  const firstAllowed: View = allowed.has('ziele_dashboard')
    ? 'ziele_dashboard'
    : ((Array.from(allowed)[0] as View) ?? 'forecast')

  const [view, setView] = useState<View>(() => {
    const stored = localStorage.getItem(VIEW_KEY) as View | null
    return stored && allowed.has(stored) ? stored : firstAllowed
  })

  useEffect(() => {
    if (!allowed.has(view)) setView(firstAllowed)
  }, [view, allowed, firstAllowed])

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1',
  )
  // Accordion: only one group open at a time. Opening another closes the
  // previous one. null = all collapsed.
  const [activeGroup, setActiveGroup] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_GROUP_KEY) || null,
  )
  const loadForecast = useForecast((s) => s.load)
  const period = useForecast((s) => s.period)
  const loadPlan = usePlan((s) => s.load)
  const plan = usePlan((s) => s.plan)
  const loadZiele = useZiele((s) => s.load)
  const ziele = useZiele((s) => s.ziele)
  const loadUmsatz = useUmsatz((s) => s.load)
  const umsatz = useUmsatz((s) => s.data)
  const loadRechnungen = useRechnungen((s) => s.load)
  const rechnungen = useRechnungen((s) => s.data)
  const loadRoster = useRoster((s) => s.load)
  const roster = useRoster((s) => s.roster)
  const loadKostenschaetzung = useKostenschaetzung((s) => s.load)
  const kostenDoc = useKostenschaetzung((s) => s.doc)
  const loadKostenermittlung = useKostenermittlung((s) => s.load)
  const keDoc = useKostenermittlung((s) => s.doc)
  const keWorkspace = useKostenermittlung((s) => s.workspace)
  const selectKeProject = useKostenermittlung((s) => s.selectProject)
  const loadImv = useImv((s) => s.load)
  const imvHydrated = useImv((s) => s.hydrated)
  const loadHr = useHr((s) => s.load)
  const hrDoc = useHr((s) => s.doc)
  const loadProjektliste = useProjektliste((s) => s.load)
  const projektlisteDoc = useProjektliste((s) => s.doc)

  useEffect(() => {
    void loadForecast()
  }, [loadForecast])

  useEffect(() => {
    if ((view === 'plan' || view === 'freigaben') && !plan) void loadPlan()
  }, [view, plan, loadPlan])

  // Keep the plan loaded for any PM-capable role so the Freigaben badge is live
  // across all views, not just when the Plan page has been opened.
  useEffect(() => {
    if (allowed.has('freigaben') && !plan) void loadPlan()
  }, [allowed, plan, loadPlan])

  const freigabenCount = useMemo(() => {
    if (!plan) return 0
    let n = 0
    for (const list of Object.values(plan.todos ?? {})) {
      for (const t of list) if (t.state === 'zurFreigabe') n++
    }
    return n
  }, [plan])

  const currentUser = useAccess((s) => s.currentUser)
  const myKuerzel = currentUser?.kuerzel ?? currentRole?.name ?? null
  void myKuerzel

  useEffect(() => {
    const isZieleView =
      view === 'ziele_dashboard' || view === 'ziele_teams' || view === 'ziele_kontrolle'
    if (isZieleView && !ziele) void loadZiele()
  }, [view, ziele, loadZiele])

  useEffect(() => {
    if (view === 'ziele_kontrolle' && !umsatz) void loadUmsatz()
  }, [view, umsatz, loadUmsatz])

  useEffect(() => {
    if (view === 'rechnungen' && !rechnungen) void loadRechnungen()
  }, [view, rechnungen, loadRechnungen])

  useEffect(() => {
    if (view === 'mitarbeiter' && !roster) void loadRoster()
  }, [view, roster, loadRoster])

  useEffect(() => {
    const isKsView =
      view === 'ks_bauwerke' ||
      view === 'ks_hoai' ||
      view === 'ks_katalog'
    if (isKsView && !kostenDoc) void loadKostenschaetzung()
  }, [view, kostenDoc, loadKostenschaetzung])

  useEffect(() => {
    // Datenbank loads its own catalog JSON; it doesn't depend on the Kostenermittlung workspace.
    const isKeDocView = view === 'ke_positionen' || view === 'ke_uebersicht'
    if (isKeDocView && !keWorkspace) void loadKostenermittlung()
  }, [view, keWorkspace, loadKostenermittlung])

  useEffect(() => {
    // Hydrate the IMV blob once the user enters any IMV sub-view.
    const isImvView = KE_IMV_VIEWS.includes(view)
    if (isImvView && !imvHydrated) void loadImv()
  }, [view, imvHydrated, loadImv])

  // Projektliste rows are needed by the KE project picker to show names
  // and offer new rows to attach a KE doc to.
  useEffect(() => {
    const isKeDocView = view === 'ke_positionen' || view === 'ke_uebersicht'
    if (isKeDocView && !projektlisteDoc) void loadProjektliste()
  }, [view, projektlisteDoc, loadProjektliste])

  // URL ↔ active KE project sync. The URL (?projekt=<id>) is session source
  // of truth; active project in the workspace is the persisted fallback.
  const isKeDocView = view === 'ke_positionen' || view === 'ke_uebersicht'
  useEffect(() => {
    if (!isKeDocView || !keWorkspace) return
    const params = new URLSearchParams(window.location.search)
    const urlId = params.get('projekt')
    const activeId = keWorkspace.activeProjektId
    const exists = (id: string | null) =>
      !!id && keWorkspace.projects.some((p) => p.projektId === id)
    if (urlId && exists(urlId)) {
      if (urlId !== activeId) selectKeProject(urlId)
    } else if (activeId && exists(activeId)) {
      const next = new URLSearchParams(window.location.search)
      next.set('projekt', activeId)
      window.history.replaceState(null, '', `?${next.toString()}`)
    } else if (urlId) {
      // Stale URL, no matching project — clean it.
      const next = new URLSearchParams(window.location.search)
      next.delete('projekt')
      const qs = next.toString()
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    }
  }, [isKeDocView, keWorkspace, selectKeProject])

  // Keep URL in sync when the user picks a different project inside the picker.
  useEffect(() => {
    if (!isKeDocView) return
    const params = new URLSearchParams(window.location.search)
    const urlId = params.get('projekt')
    const activeId = keWorkspace?.activeProjektId ?? null
    if (activeId && urlId !== activeId) {
      params.set('projekt', activeId)
      window.history.replaceState(null, '', `?${params.toString()}`)
    } else if (!activeId && urlId) {
      params.delete('projekt')
      const qs = params.toString()
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    }
  }, [isKeDocView, keWorkspace?.activeProjektId])

  useEffect(() => {
    const isHrView = view === 'hr_zeiterfassung' || view === 'hr_gespraeche'
    if (isHrView && !hrDoc) void loadHr()
  }, [view, hrDoc, loadHr])

  useEffect(() => {
    if (view === 'projektliste' && !projektlisteDoc) void loadProjektliste()
  }, [view, projektlisteDoc, loadProjektliste])

  // Log module opens once per view change. Debounced via a ref so re-renders
  // (e.g. from store subscriptions) don't double-fire.
  const lastLoggedView = useRef<View | null>(null)
  useEffect(() => {
    if (lastLoggedView.current === view) return
    lastLoggedView.current = view
    const moduleId = viewToModule(view)
    if (moduleId) logActivity({ kind: 'view', module: moduleId })
  }, [view])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    if (activeGroup) localStorage.setItem(ACTIVE_GROUP_KEY, activeGroup)
    else localStorage.removeItem(ACTIVE_GROUP_KEY)
  }, [activeGroup])

  // Auto-open the group that contains the current view (e.g. after ⌘K jumps).
  // Depends only on `view` so toggling a group header manually isn't
  // immediately overridden back to the group of the active view.
  useEffect(() => {
    const containing = NAV.find(
      (e) => e.kind === 'group' && (e.children as View[]).includes(view),
    )
    if (containing && containing.kind === 'group') {
      setActiveGroup(containing.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const meta = VIEW_META[view]

  return (
    <>
    <CommandPalette onNavigate={(v) => setView(v as View)} />
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar
        nav={nav}
        view={view}
        onSelect={setView}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        expandedByGroup={{
          operative: activeGroup === 'operative',
          einstellungen: activeGroup === 'einstellungen',
          kostenschaetzung: activeGroup === 'kostenschaetzung',
          kostenermittlung: activeGroup === 'kostenermittlung',
          kostenermittlung_imv: activeGroup === 'kostenermittlung_imv',
          hr: activeGroup === 'hr',
          ziele: activeGroup === 'ziele',
        }}
        onToggleGroup={(id) => {
          // Accordion toggle — clicking the active group collapses it, any
          // other group opens (which implicitly closes the previous one).
          setActiveGroup((prev) => (prev === id ? null : id))
        }}
        freigabenCount={freigabenCount}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ViewAsBanner />
        <header className="bg-background">
          <div className="flex min-h-[62px] items-center justify-between gap-4 px-6 py-4">
            <h1 className="text-base font-semibold">{meta.title}</h1>
            <div className="flex items-center gap-4">
              {view === 'forecast' && <SaveStatus />}
              {view === 'plan' && <PlanSaveStatus />}
              {(view === 'ziele_dashboard' || view === 'ziele_teams') && <ZieleSaveStatus />}
              {view === 'ziele_kontrolle' && <UmsatzSaveStatus />}
              {view === 'rechnungen' && <RechnungenSaveStatus />}
              {view === 'projektliste' && <ProjektlisteSaveStatus />}
              {(view === 'ks_bauwerke' ||
                view === 'ks_hoai' ||
                view === 'ks_katalog') && <KostenschaetzungSaveStatus />}
              {(view === 'ke_positionen' || view === 'ke_uebersicht') && (
                <KostenermittlungSaveStatus />
              )}
              {/* ke_datenbank is read-only — no save status needed. */}
              {KE_IMV_VIEWS.includes(view) && <KostenermittlungImvSaveStatus />}
              {(view === 'hr_zeiterfassung' || view === 'hr_gespraeche') && <HrSaveStatus />}
              <ViewPeriodPicker view={view} />
              {view === 'forecast' && <ImportDialog />}
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-8 px-6 py-6">
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
          {view === 'freigaben' &&
            (plan ? <Freigaben /> : <LoadingCard>Lade Freigaben…</LoadingCard>)}
          {view === 'dashboard' && <Dashboard />}
          {view === 'ziele_dashboard' && <ZieleDashboardPage />}
          {view === 'ziele_teams' && <ZieleTeamsPage />}
          {view === 'ziele_kontrolle' && <Umsatzkontrolle />}
          {view === 'rechnungen' && <Rechnungen />}
          {view === 'projektliste' && <Projektliste />}
          {view === 'ks_bauwerke' &&
            (kostenDoc ? <BauwerkeTab /> : <LoadingCard>Lade Kostenschätzung…</LoadingCard>)}
          {view === 'ks_hoai' &&
            (kostenDoc ? <HoaiTab /> : <LoadingCard>Lade Kostenschätzung…</LoadingCard>)}
          {view === 'ks_katalog' &&
            (kostenDoc ? <KatalogTab /> : <LoadingCard>Lade Kostenschätzung…</LoadingCard>)}
          {(view === 'ke_positionen' || view === 'ke_uebersicht') && (
            keWorkspace ? (
              <div className="-mx-6 -mt-6">
                <KeProjectPicker
                  onNavigateProjektliste={() => setView('projektliste')}
                />
                <div className="px-6 py-6">
                  {keDoc ? (
                    view === 'ke_positionen' ? <KePositionenTab /> : <KeUebersichtTab />
                  ) : (
                    <EmptyKeState />
                  )}
                </div>
              </div>
            ) : (
              <LoadingCard>Lade Kostenermittlung…</LoadingCard>
            )
          )}
          {view === 'ke_datenbank' && <KeDatenbankTab />}
          {KE_IMV_VIEWS.includes(view) && <KeImvFrame view={view} />}
          {view === 'hr_zeiterfassung' &&
            (hrDoc ? <HrZeiterfassungTab /> : <LoadingCard>Lade HR…</LoadingCard>)}
          {view === 'hr_gespraeche' &&
            (hrDoc ? <HrGespraecheTab /> : <LoadingCard>Lade HR…</LoadingCard>)}
          {view === 'mitarbeiter' && <Mitarbeiter />}
          {view === 'settings' && <Settings />}
          {view === 'aktivitaet' && <Aktivitaet />}
        </main>
      </div>
    </div>
    </>
  )
}

function Sidebar({
  nav,
  view,
  onSelect,
  collapsed,
  onToggleCollapsed,
  expandedByGroup,
  onToggleGroup,
  freigabenCount,
}: {
  nav: NavEntry[]
  view: View
  onSelect: (v: View) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  expandedByGroup: Record<string, boolean>
  onToggleGroup: (id: string) => void
  freigabenCount: number
}) {
  // Hand-rolled hover flyout for the collapsed rail. A single always-mounted
  // panel (no portal mount/measure on each switch) tracks whichever group
  // icon is currently hovered — moving between icons just updates `top` and
  // the child list, so the panel visibly translates instead of blinking.
  const [hovered, setHovered] = useState<
    { id: string; top: number; left: number } | null
  >(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setHovered(null), 60)
  }
  const hoverGroup = (id: string, target: HTMLElement) => {
    cancelClose()
    const rect = target.getBoundingClientRect()
    setHovered({ id, top: rect.top, left: rect.right + 2 })
  }
  useEffect(() => {
    // Expanding the sidebar collapses any open flyout.
    if (!collapsed) setHovered(null)
  }, [collapsed])
  const hoveredEntry = useMemo(
    () =>
      hovered
        ? (nav.find((e) => e.kind === 'group' && e.id === hovered.id) as
            | Extract<NavEntry, { kind: 'group' }>
            | undefined)
        : undefined,
    [hovered, nav],
  )
  return (
    <>
    <aside
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col border-r bg-background transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <div
        className={cn(
          'flex items-center border-b',
          collapsed ? 'justify-center px-1 py-2' : 'px-2 py-2',
        )}
      >
        <UserMenu collapsed={collapsed} />
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {nav.map((entry) => {
          if (entry.kind === 'leaf') {
            return (
              <NavItem
                key={entry.view}
                icon={VIEW_META[entry.view].icon}
                label={VIEW_META[entry.view].label}
                active={entry.view === view}
                collapsed={collapsed}
                badge={entry.view === 'freigaben' ? freigabenCount : 0}
                onClick={() => onSelect(entry.view)}
              />
            )
          }
          const childActive = entry.children.includes(view)
          const expanded = expandedByGroup[entry.id] ?? true
          const groupBadge = entry.children.includes('freigaben' as View)
            ? freigabenCount
            : 0
          if (collapsed) {
            // Collapsed rail: just the group icon. Hover moves the shared
            // flyout rendered at the end of the sidebar.
            const Icon = entry.icon
            return (
              <button
                key={entry.id}
                type="button"
                onMouseEnter={(e) => hoverGroup(entry.id, e.currentTarget)}
                onFocus={(e) => hoverGroup(entry.id, e.currentTarget)}
                onMouseLeave={scheduleClose}
                onBlur={scheduleClose}
                title={groupBadge > 0 ? `${entry.label} (${groupBadge})` : entry.label}
                className={cn(
                  'relative flex w-full items-center justify-center rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors',
                  childActive
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {groupBadge > 0 && (
                  <span className="absolute right-1 top-1 inline-flex min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 font-mono text-[9px] font-semibold leading-none text-destructive-foreground">
                    {groupBadge}
                  </span>
                )}
              </button>
            )
          }
          return (
            <div key={entry.id}>
              <NavGroupHeader
                icon={entry.icon}
                label={entry.label}
                expanded={expanded}
                collapsed={collapsed}
                childActive={childActive}
                badge={!expanded ? groupBadge : 0}
                onToggle={() => onToggleGroup(entry.id)}
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
                    badge={childView === 'freigaben' ? freigabenCount : 0}
                    onClick={() => onSelect(childView)}
                  />
                ))}
            </div>
          )
        })}
      </nav>

      <div className="border-t p-2">
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
      </div>
    </aside>

    {/* Always-mounted shared flyout. position:fixed uses the hovered icon's
        rect so switching groups just repaints `top` + children — no portal
        mount, no Popper measurement, no visible delay. */}
    {collapsed && (
      <div
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        style={{
          position: 'fixed',
          top: hovered?.top ?? 0,
          left: hovered?.left ?? 0,
          visibility: hoveredEntry ? 'visible' : 'hidden',
          pointerEvents: hoveredEntry ? 'auto' : 'none',
        }}
        className="z-50 min-w-[200px] rounded-lg border bg-card p-1 shadow-lg"
      >
        {hoveredEntry && (
          <>
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              {hoveredEntry.label}
            </div>
            <div className="py-1">
              {hoveredEntry.children.map((childView) => (
                <FlyoutItem
                  key={childView}
                  icon={VIEW_META[childView].icon}
                  label={VIEW_META[childView].label}
                  active={childView === view}
                  badge={childView === 'freigaben' ? freigabenCount : 0}
                  onClick={() => {
                    onSelect(childView)
                    setHovered(null)
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    )}
    </>
  )
}

function ViewPeriodPicker({ view }: { view: View }) {
  switch (view) {
    case 'ziele_dashboard':
    case 'ziele_teams':
      return <ZielePicker />
    case 'dashboard':
      return <DashboardPicker />
    case 'forecast':
      return <ForecastPicker />
    case 'plan':
      return <PlanPicker />
    case 'freigaben':
      return <FreigabenPicker />
    case 'ziele_kontrolle':
      return <UmsatzPicker />
    case 'rechnungen':
      return <RechnungenPicker />
    case 'projektliste':
      return null
    case 'ks_bauwerke':
    case 'ks_hoai':
    case 'ks_katalog':
      return null
    case 'ke_positionen':
    case 'ke_uebersicht':
    case 'ke_datenbank':
      return null
    case 'hr_zeiterfassung':
    case 'hr_gespraeche':
      return null
    case 'mitarbeiter':
      return null
    case 'settings':
      return null
    case 'aktivitaet':
      return null
  }
}

function ZielePicker() {
  const year = useZiele((s) => s.year)
  const halbjahr = useZiele((s) => s.halbjahr)
  const setYear = useZiele((s) => s.setYear)
  const setHalbjahr = useZiele((s) => s.setHalbjahr)
  const halbjahrOrAll: HalbjahrOrAll =
    halbjahr === 'h1' ? 'H1' : halbjahr === 'h2' ? 'H2' : 'all'
  return (
    <PeriodPicker
      year={year}
      onYearChange={setYear}
      halbjahr={halbjahrOrAll}
      onHalbjahrChange={(h) =>
        setHalbjahr(h === 'H1' ? 'h1' : h === 'H2' ? 'h2' : 'all')
      }
    />
  )
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

function FreigabenPicker() {
  const year = usePlan((s) => s.year)
  const setYear = usePlan((s) => s.setYear)
  return <PeriodPicker year={year} onYearChange={setYear} />
}

function RechnungenPicker() {
  const year = useRechnungen((s) => s.year)
  const month = useRechnungen((s) => s.month)
  const setYear = useRechnungen((s) => s.setYear)
  const setMonth = useRechnungen((s) => s.setMonth)
  return (
    <PeriodPicker
      year={year}
      onYearChange={setYear}
      month={month}
      onMonthChange={setMonth}
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
  badge = 0,
  onClick,
}: {
  icon: typeof Table2
  label: string
  active: boolean
  collapsed: boolean
  nested?: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? (badge > 0 ? `${label} (${badge})` : label) : undefined}
      className={cn(
        'relative flex w-full items-center gap-2 rounded-md py-1.5 text-[13px] font-medium transition-colors',
        collapsed ? 'justify-center px-2' : nested ? 'pl-7 pr-3' : 'px-3',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {badge > 0 &&
        (collapsed ? (
          <span className="absolute right-1 top-1 inline-flex min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 font-mono text-[9px] font-semibold leading-none text-destructive-foreground">
            {badge}
          </span>
        ) : (
          <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-destructive-foreground">
            {badge}
          </span>
        ))}
    </button>
  )
}

function NavGroupHeader({
  icon: Icon,
  label,
  expanded,
  collapsed,
  childActive,
  badge = 0,
  onToggle,
}: {
  icon: typeof Table2
  label: string
  expanded: boolean
  collapsed: boolean
  childActive: boolean
  badge?: number
  onToggle: () => void
}) {
  if (collapsed) {
    return (
      <div
        title={badge > 0 ? `${label} (${badge})` : label}
        className={cn(
          'relative flex w-full items-center justify-center rounded-md px-2 py-1.5 text-[13px] font-medium',
          childActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
        {badge > 0 && (
          <span className="absolute right-1 top-1 inline-flex min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 font-mono text-[9px] font-semibold leading-none text-destructive-foreground">
            {badge}
          </span>
        )}
      </div>
    )
  }
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-normal transition-colors',
        childActive ? 'text-foreground' : 'text-muted-foreground',
        'hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 && (
        <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-destructive-foreground">
          {badge}
        </span>
      )}
      {expanded ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function FlyoutItem({
  icon: Icon,
  label,
  active,
  badge = 0,
  onClick,
}: {
  icon: typeof Table2
  label: string
  active: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px] font-medium transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-destructive-foreground">
          {badge}
        </span>
      )}
    </button>
  )
}

function EmptyKeState() {
  return (
    <div className="mx-auto max-w-md rounded-md border bg-card px-6 py-10 text-center">
      <div className="text-sm font-semibold">Kein Projekt ausgewählt</div>
      <p className="mt-2 text-xs text-muted-foreground">
        Wähle oben ein Projekt aus der Projektliste, oder lege eins über
        «Neu» an.
      </p>
    </div>
  )
}

const IMV_VIEW_MAP: Record<string, string> = {
  ke_imv_uebersicht: 'overview',
  ke_imv_projekte: 'estimate',
  ke_imv_ril: 'ril',
  ke_imv_free: 'free',
  ke_imv_entry: 'entry',
  ke_imv_indices: 'indices',
}

function KeImvFrame({ view }: { view: View }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const readyRef = useRef(false)
  const doc = useImv((s) => s.doc)
  const hydrated = useImv((s) => s.hydrated)
  const receiveFromFrame = useImv((s) => s.receiveFromFrame)
  // Hold the latest doc in a ref so the message handler can respond to a
  // late requestHydrate without re-subscribing.
  const docRef = useRef(doc)
  useEffect(() => {
    docRef.current = doc
  }, [doc])
  const hydratedRef = useRef(hydrated)
  useEffect(() => {
    hydratedRef.current = hydrated
  }, [hydrated])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return
      const data = e.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'imv:ready') {
        readyRef.current = true
        const target = IMV_VIEW_MAP[view]
        if (target) ref.current?.contentWindow?.postMessage({ type: 'imv:setView', view: target }, '*')
        // Sync host theme + accent into the iframe on first ready.
        const cls = document.documentElement.classList
        const theme = cls.contains('dark') ? 'dark' : 'light'
        ref.current?.contentWindow?.postMessage({ type: 'imv:setTheme', theme }, '*')
        const accent = ['blue','teal','amber','rose','violet'].find((a) => cls.contains('theme-' + a)) ?? 'indigo'
        ref.current?.contentWindow?.postMessage({ type: 'imv:setAccent', accent }, '*')
      } else if (data.type === 'imv:requestHydrate') {
        // Iframe is asking for initial state. If we've loaded from the server
        // already, reply now; otherwise wait — the effect below will respond
        // when the store flips to hydrated.
        if (hydratedRef.current) {
          ref.current?.contentWindow?.postMessage({ type: 'imv:hydrate', state: docRef.current }, '*')
        }
      } else if (data.type === 'imv:persist') {
        // Iframe reports its current full state; debounce-save to server.
        receiveFromFrame(data.state)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [view, receiveFromFrame])

  // Watch host <html> class for theme + accent changes and mirror into the iframe.
  useEffect(() => {
    const obs = new MutationObserver(() => {
      if (!readyRef.current) return
      const cls = document.documentElement.classList
      const theme = cls.contains('dark') ? 'dark' : 'light'
      ref.current?.contentWindow?.postMessage({ type: 'imv:setTheme', theme }, '*')
      const accent = ['blue','teal','amber','rose','violet'].find((a) => cls.contains('theme-' + a)) ?? 'indigo'
      ref.current?.contentWindow?.postMessage({ type: 'imv:setAccent', accent }, '*')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // If hydration completes AFTER the iframe asked for state, reply now.
  useEffect(() => {
    if (hydrated) {
      ref.current?.contentWindow?.postMessage({ type: 'imv:hydrate', state: doc }, '*')
    }
  }, [hydrated, doc])

  // On sub-view change after ready, push the new view into the iframe.
  useEffect(() => {
    if (!readyRef.current) return
    const target = IMV_VIEW_MAP[view]
    if (target) ref.current?.contentWindow?.postMessage({ type: 'imv:setView', view: target }, '*')
  }, [view])

  return (
    <iframe
      ref={ref}
      src="/imv-kostenermittlung.html"
      title="Kostenermittlung IMV"
      className="-m-6 block border-0"
      style={{ width: 'calc(100% + 3rem)', height: 'calc(100vh - 62px)' }}
    />
  )
}
