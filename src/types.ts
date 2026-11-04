export type RiskFlag = 'k' | 'w' // kritisch | wahrscheinlich

export type ProjectRow = {
  id: string
  projektleiterDE: string
  projektleiterPL: string
  projektname: string
  projNr: string
  leistung: string
  forecastDE: number | null
  flagDE: RiskFlag
  forecastPL: number | null
  flagPL: RiskFlag
  abgerechnetDE: number | null
  abgerechnetPL: number | null
  leistungsstandDE: number | null // 0..1
  leistungsstandPL: number | null // 0..1
  prio?: boolean
  prioAllowOvertime?: boolean
}

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export type Period = {
  year: number
  quarter: Quarter
  rows: ProjectRow[]
}

export type PlanStatus = 'abstimmen' | 'urlaub' | 'abgabe'

export const PLAN_STATUSES: PlanStatus[] = ['abstimmen', 'urlaub', 'abgabe']

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  abstimmen: 'Abstimmen',
  urlaub: 'Urlaub',
  abgabe: 'Abgabe',
}

export type TodoState = 'offen' | 'inProgress' | 'erledigt'
export const TODO_STATES: TodoState[] = ['offen', 'inProgress', 'erledigt']
export const TODO_STATE_LABELS: Record<TodoState, string> = {
  offen: 'Offen',
  inProgress: 'In Bearbeitung',
  erledigt: 'Erledigt',
}
export function nextTodoState(s: TodoState): TodoState {
  const i = TODO_STATES.indexOf(s)
  return TODO_STATES[(i + 1) % TODO_STATES.length]
}

export type WeekTodo = {
  id: string
  text: string
  state: TodoState
  // Only used when the todo represents Urlaub. 1..5 = Mo..Fr. Empty/undefined = whole week.
  days?: number[]
  // 0..100, used on "Aufgabe"-type todos so the PM sees how far along.
  progress?: number
}

export const MAX_TODOS_PER_WEEK = 10

export type Branch = 'de' | 'pl'

export type Employee = {
  id: string
  name: string
  branch: Branch
}

export type QuartalPlan = {
  year: number
  employees: Employee[]
  cells: Record<string, PlanStatus>
  // Key `${empIndex}:${week}` -> todos for that employee/week cell.
  todos?: Record<string, WeekTodo[]>
}

// Legacy shapes stored before this migration landed.
type LegacyTodo = { id: string; text: string; done?: boolean; state?: TodoState; days?: number[]; progress?: number }
type LegacyPlan = Omit<QuartalPlan, 'employees' | 'todos'> & {
  employees: Array<string | Employee>
  todos?: Record<string, LegacyTodo[]>
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function migratePlan(input: QuartalPlan | LegacyPlan | null | undefined): QuartalPlan | null {
  if (!input) return null
  const employees: Employee[] = (input.employees ?? []).map((e) =>
    typeof e === 'string' ? { id: newId(), name: e, branch: 'de' as Branch } : {
      id: e.id ?? newId(),
      name: e.name,
      branch: (e.branch ?? 'de') as Branch,
    },
  )
  const todos: Record<string, WeekTodo[]> = {}
  for (const [k, list] of Object.entries(input.todos ?? {})) {
    todos[k] = ((list as LegacyTodo[] | undefined) ?? []).map((t: LegacyTodo) => ({
      id: t.id,
      text: t.text,
      state: t.state ?? (t.done ? 'erledigt' : 'offen'),
      days: t.days,
      progress: t.progress,
    }))
  }
  return { year: input.year, employees, cells: input.cells ?? {}, todos }
}

export type ZielePersonRole = 'team' | 'ausschreibung' | 'verwaltung'

export type ZielePerson = {
  id: string
  name: string
  fte: number
  role?: ZielePersonRole // defaults to 'team'
}

export type ZieleTeam = {
  id: string
  name: string
  people: ZielePerson[]
}

export type ZieleBranch = {
  id: 'de' | 'pl'
  label: string
  umsatzProFTE: number
  ruhendePct: number // 0..1
  teams: ZieleTeam[]
}

export type Ziele = {
  year: number
  branches: ZieleBranch[]
}

export type UmsatzBranch = 'de' | 'pl'
export type MonthValues = (number | null)[] // length 12, Jan..Dez

// Storage shape: only the operational data that Zielkontrolle owns.
// Team name, branch, fte, and ziel are derived from Ziele at render time.
export type UmsatzTeam = {
  id: string // matches ZieleTeam.id after migration
  forecast: MonthValues
  rechnungen: MonthValues
}

export type Umsatzkontrolle = {
  year: number
  teams: UmsatzTeam[]
}

// Render-time view produced by merging Ziele + Umsatzkontrolle.
export type UmsatzTeamView = {
  id: string
  name: string
  branch: UmsatzBranch
  fte: number
  forecast: MonthValues
  rechnungen: MonthValues
  ziel: MonthValues
}

export function emptyMonthValues(): MonthValues {
  return Array.from({ length: 12 }, () => null)
}

// --- Rechnungen (invoices) ------------------------------------------------

export type RechnungStatus = 'offen' | 'bezahlt' | 'mahnung' | 'storniert'
export const RECHNUNG_STATUSES: RechnungStatus[] = ['offen', 'bezahlt', 'mahnung', 'storniert']
export const RECHNUNG_STATUS_LABELS: Record<RechnungStatus, string> = {
  offen: 'Offen',
  bezahlt: 'Bezahlt',
  mahnung: 'Mahnung',
  storniert: 'Storniert',
}

export type Rechnung = {
  id: string
  nr: string           // Rechnungsnummer
  datum: string        // ISO YYYY-MM-DD
  kunde: string
  projekt: string
  netto: number | null
  ustPct: number | null // default 19
  status: RechnungStatus
  faellig: string      // ISO YYYY-MM-DD, Zahlungsziel
  bezahltAm: string    // ISO YYYY-MM-DD
  notiz: string
}

export type RechnungenData = {
  year: number
  rows: Rechnung[]
}

export function bruttoOf(r: Rechnung): number | null {
  if (r.netto === null) return null
  const u = r.ustPct ?? 19
  return Math.round(r.netto * (1 + u / 100) * 100) / 100
}

// --- Access control (role-based: role name + password → modules) ----------

export type ModuleId =
  | 'dashboard'
  | 'forecast'
  | 'plan'
  | 'plan_overview'
  | 'ziele'
  | 'umsatz'
  | 'rechnungen'
  | 'settings'

export const MODULES: ModuleId[] = [
  'ziele',
  'dashboard',
  'forecast',
  'plan',
  'plan_overview',
  'umsatz',
  'rechnungen',
  'settings',
]

export const MODULE_LABELS: Record<ModuleId, string> = {
  dashboard: 'Dashboard',
  forecast: 'Forecast',
  plan: 'Quartalsplanung',
  plan_overview: 'Quartalsplanung (nur Übersicht)',
  ziele: 'Ziele',
  umsatz: 'Zielkontrolle',
  rechnungen: 'Rechnungen',
  settings: 'Einstellungen',
}

export type Role = {
  id: string
  name: string
  password: string
  modules: ModuleId[]
}

export type AccessConfig = {
  roles: Role[]
}

// Preset role templates the admin starts with (name + sensible default modules).
// They can rename / delete / add new. Admin picks these by clicking a chip in
// the new-role form and the module checkboxes auto-fill.
export type RolePreset = { name: string; modules: ModuleId[] }

export const PRESET_ROLES: RolePreset[] = [
  {
    name: 'GF und Teamleiter',
    modules: ['dashboard', 'forecast', 'plan', 'ziele', 'umsatz', 'rechnungen', 'settings'],
  },
  {
    name: 'Verwaltung',
    modules: ['dashboard', 'forecast', 'plan', 'ziele', 'umsatz', 'rechnungen'],
  },
  {
    name: 'Projektleiter',
    modules: ['dashboard', 'forecast', 'plan', 'rechnungen'],
  },
  { name: 'Projektingenieur', modules: ['plan_overview'] },
  { name: 'Konstrukteur', modules: ['plan_overview'] },
  { name: 'Azubis', modules: ['plan_overview'] },
  { name: 'Werkstudenten', modules: ['plan_overview'] },
]

// Legacy export some callers still use for the name list only.
export const PRESET_ROLE_NAMES = PRESET_ROLES.map((p) => p.name)

export function emptyAccessConfig(): AccessConfig {
  return { roles: [] }
}

// Derived values per row
export type Derived = {
  forecastDEBereinigt: number | null // G - I
  abgerechnetDEBereinigt: number | null // M - N
  nochOffenDE: number | null // K - O
  diffPL: number | null // I - N
  gewichtetDE: number | null // K * R
  gewichtetPL: number | null // I * T
}

export function derive(r: ProjectRow): Derived {
  // Business rule: no Forecast DE (0 or empty) → bereinigt is 0, don't subtract PL.
  const noDE = r.forecastDE === 0 || r.forecastDE === null
  const K = noDE ? 0 : sub(r.forecastDE, r.forecastPL)
  const O = sub(r.abgerechnetDE, r.abgerechnetPL)
  return {
    forecastDEBereinigt: K,
    abgerechnetDEBereinigt: O,
    nochOffenDE: sub(K, O),
    diffPL: sub(r.forecastPL, r.abgerechnetPL),
    gewichtetDE: mul(K, r.leistungsstandDE),
    gewichtetPL: mul(r.forecastPL, r.leistungsstandPL),
  }
}

function sub(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null
  return (a ?? 0) - (b ?? 0)
}

function mul(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  return a * b
}
