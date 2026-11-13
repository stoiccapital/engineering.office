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

export type TodoState = 'offen' | 'inProgress' | 'zurFreigabe' | 'erledigt'
export const TODO_STATES: TodoState[] = ['offen', 'inProgress', 'zurFreigabe', 'erledigt']
export const TODO_STATE_LABELS: Record<TodoState, string> = {
  offen: 'Offen',
  inProgress: 'In Bearbeitung',
  zurFreigabe: 'Zur Freigabe',
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
  // Reason supplied by the PM when rejecting a Zur-Freigabe submission.
  // Present on an inProgress todo means the last submission was rejected.
  rejectReason?: string
}

export type Branch = 'de' | 'pl'

export type Employee = {
  id: string
  name: string
  branch: Branch
  // Optional link to a RosterEmployee. When set, display name + grouping come
  // from the roster (vorname + name, team → location); otherwise the legacy
  // branch grouping is used as fallback so existing plans keep rendering.
  rosterEmployeeId?: string
}

// Backlog of todos the PM has prepared but not yet scheduled. Each pool task
// belongs to a specific employee column; promoting one into a week cell only
// requires picking the KW (the employee is implicit).
export type PoolTask = {
  id: string
  text: string
  empIndex: number
}

export type QuartalPlan = {
  year: number
  employees: Employee[]
  cells: Record<string, PlanStatus>
  // Key `${empIndex}:${week}` -> todos for that employee/week cell.
  todos?: Record<string, WeekTodo[]>
  pool?: PoolTask[]
}

// Legacy shapes stored before this migration landed.
type LegacyTodo = { id: string; text: string; done?: boolean; state?: TodoState; days?: number[]; progress?: number }
type LegacyPoolTask = { id: string; text: string; empIndex?: number }
type LegacyPlan = Omit<QuartalPlan, 'employees' | 'todos' | 'pool'> & {
  employees: Array<string | Employee>
  todos?: Record<string, LegacyTodo[]>
  pool?: LegacyPoolTask[]
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
  // Pool tasks without an empIndex (shipped before the per-employee split)
  // get parked on the first employee so nothing is lost.
  const pool: PoolTask[] = (input.pool ?? []).map((t) => ({
    id: t.id,
    text: t.text,
    empIndex: t.empIndex ?? 0,
  }))
  return { year: input.year, employees, cells: input.cells ?? {}, todos, pool }
}

export type ZielePersonRole = 'team' | 'ausschreibung' | 'verwaltung'

// FTE is tracked per half-year so mid-year hires or part-time schedule changes
// can be reflected without losing precision. A legacy flat number migrates to
// { h1: value, h2: value }.
export type PersonFTE = {
  h1: number
  h2: number
}

export type ZielePerson = {
  id: string
  name: string
  fte: PersonFTE
  role?: ZielePersonRole // defaults to 'team'
}

export function personFTE(p: ZielePerson, half?: 'h1' | 'h2'): number {
  if (half) return p.fte[half] ?? 0
  return ((p.fte.h1 ?? 0) + (p.fte.h2 ?? 0)) / 2
}

// Per-bucket allocation share (0..1). Undefined on a bucket means
// "use the auto default = this team's operative FTE / branch operative FTE".
// Summed across all teams of a branch each bucket should equal 1 to fully
// allocate that overhead pool.
export type Teilungsschluessel = {
  verwaltung?: number
  ausschreibung?: number
}

export type ZieleTeam = {
  id: string
  name: string
  people: ZielePerson[]
  teilungsschluessel?: Teilungsschluessel
}

// Half-year split: PMs often expect different revenue-per-FTE in H1 vs H2.
// Legacy flat `umsatzProFTE: number` → halved onto both halves at migration time.
export type UmsatzProFTE = {
  h1: number
  h2: number
}

export type ZieleBranch = {
  id: 'de' | 'pl'
  label: string
  umsatzProFTE: UmsatzProFTE
  ruhendePct: number // 0..1
  teams: ZieleTeam[]
}

export type Ziele = {
  year: number
  branches: ZieleBranch[]
  // Locked prevents further edits. Any ziele-module role can lock;
  // only plan-module roles (PMs) may unlock.
  locked?: boolean
  lockedAt?: string // ISO timestamp
  lockedBy?: string // role name for the banner
}

// Legacy shapes stored before successive migrations landed.
type LegacyZielePerson = Omit<ZielePerson, 'fte'> & {
  fte: number | PersonFTE
}
type LegacyZieleTeam = Omit<ZieleTeam, 'people' | 'teilungsschluessel'> & {
  people: LegacyZielePerson[]
  // Legacy single Teilungsschlüssel applied to combined (Verw + Aussch) pool.
  // Migrated to { verwaltung: n, ausschreibung: n } so the formula still sums
  // to n×(verw+aussch) in isolation.
  teilungsschluessel?: number | Teilungsschluessel
}
type LegacyZieleBranch = Omit<ZieleBranch, 'umsatzProFTE' | 'teams'> & {
  umsatzProFTE: number | UmsatzProFTE
  teams: LegacyZieleTeam[]
}
type LegacyZiele = Omit<Ziele, 'branches'> & { branches: LegacyZieleBranch[] }

function migratePersonFTE(fte: number | PersonFTE | undefined): PersonFTE {
  if (fte === undefined || fte === null) return { h1: 0, h2: 0 }
  if (typeof fte === 'number') return { h1: fte, h2: fte }
  return { h1: fte.h1 ?? 0, h2: fte.h2 ?? 0 }
}

function migrateTeilungsschluessel(
  ts: number | Teilungsschluessel | undefined,
): Teilungsschluessel | undefined {
  if (ts === undefined || ts === null) return undefined
  if (typeof ts === 'number') return { verwaltung: ts, ausschreibung: ts }
  const out: Teilungsschluessel = {}
  if (typeof ts.verwaltung === 'number') out.verwaltung = ts.verwaltung
  if (typeof ts.ausschreibung === 'number') out.ausschreibung = ts.ausschreibung
  return out.verwaltung !== undefined || out.ausschreibung !== undefined
    ? out
    : undefined
}

export function migrateZiele(input: Ziele | LegacyZiele | null | undefined): Ziele | null {
  if (!input) return null
  const branches: ZieleBranch[] = input.branches.map((b) => {
    const u = b.umsatzProFTE
    const umsatzProFTE: UmsatzProFTE =
      typeof u === 'number' ? { h1: u / 2, h2: u / 2 } : { h1: u.h1 ?? 0, h2: u.h2 ?? 0 }
    const teams: ZieleTeam[] = b.teams.map((t) => ({
      ...t,
      teilungsschluessel: migrateTeilungsschluessel(t.teilungsschluessel),
      people: t.people.map((p) => ({ ...p, fte: migratePersonFTE(p.fte) })),
    }))
    return { ...b, umsatzProFTE, teams }
  })
  return { ...input, branches }
}

export function annualUmsatzProFTE(u: UmsatzProFTE): number {
  return (u.h1 ?? 0) + (u.h2 ?? 0)
}

export type ActivityKind = 'login' | 'view' | 'action'

export type ActivityEvent = {
  ts: string // ISO
  user: string // kürzel (fallback: role name)
  kind: ActivityKind
  module?: ModuleId // for 'view'
  action?: string // for 'action' (e.g. 'ziele.lock', 'role.create')
  target?: string // optional context (e.g. role name, person name)
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

// --- Rechnungsplanung -----------------------------------------------------
// Monthly billing-plan matrix mirroring the PM Excel workflow.
// One row per project (or sub-project like "Teil 1. Harras").
// Each row carries a status per Hauptvertrag + N01..N0X Nachträge,
// optional Zeithonorar, DE/PL amounts, Nachtragssumme, and free-text notes.

export type NStatus = 'aktuell' | 'nichtRelevant' | 'neu' | 'rgGestellt'

export const N_STATUSES: NStatus[] = ['aktuell', 'nichtRelevant', 'neu', 'rgGestellt']

export const N_STATUS_LABELS: Record<NStatus, string> = {
  aktuell: 'Aktuell',
  nichtRelevant: '–',
  neu: 'Neu',
  rgGestellt: 'Rg. gestellt',
}

export type NEntry = {
  status: NStatus
  // ISO YYYY-MM-DD, set when the PM records when the invoice was actually sent.
  // Shown in the cell alongside the "Rg. gestellt" label.
  datum?: string
}

export type PlBranchStatus = 'nein' | 'ja' | 'neu'
export const PL_BRANCH_STATUSES: PlBranchStatus[] = ['nein', 'ja', 'neu']
export const PL_BRANCH_LABELS: Record<PlBranchStatus, string> = {
  nein: 'Nein',
  ja: 'Ja',
  neu: 'Neu',
}

export type RechnungsplanRow = {
  id: string
  projNr: string
  projektname: string
  pl: string // Projektleiter-Kürzel, Freitext
  deStatus: NStatus // "Deutschland" column
  plBranch: PlBranchStatus // "Polen" column
  hv: NEntry
  nachtraege: NEntry[] // fixed length = month.nachtragCount
  zeithonorar?: NEntry // optional, only when month.showZeithonorar
  rgSummeDE: number | null
  rgSummePL: number | null
  nachtragErbracht: number | null
  // Keyed by NoteColumn.id → text; missing key = empty note.
  notes: Record<string, string>
}

export type NoteColumn = {
  id: string
  label: string // e.g. "Bemerkung (Alberon)" or "Fragen (Nena)"
}

export type Rechnungsplan = {
  year: number
  month: number // 1..12
  nachtragCount: number // how many N01..N0X columns to render
  showZeithonorar: boolean
  noteColumns: NoteColumn[] // fixed default on creation, editable
  rows: RechnungsplanRow[]
}

export function emptyNEntry(): NEntry {
  return { status: 'nichtRelevant' }
}

export function emptyRechnungsplanRow(nachtragCount: number, withZeithonorar: boolean): RechnungsplanRow {
  return {
    id: '',
    projNr: '',
    projektname: '',
    pl: '',
    deStatus: 'aktuell',
    plBranch: 'nein',
    hv: { status: 'aktuell' },
    nachtraege: Array.from({ length: nachtragCount }, () => emptyNEntry()),
    zeithonorar: withZeithonorar ? emptyNEntry() : undefined,
    rgSummeDE: null,
    rgSummePL: null,
    nachtragErbracht: null,
    notes: {},
  }
}

export const DEFAULT_RECHNUNGSPLAN_NOTE_COLUMNS: NoteColumn[] = [
  { id: 'bemerkung1', label: 'Bemerkung (Alberon)' },
  { id: 'bemerkung2', label: 'Bemerkung (Dawid)' },
  { id: 'fragen', label: 'Fragen (Nena)' },
]

export function emptyRechnungsplan(year: number, month: number): Rechnungsplan {
  return {
    year,
    month,
    nachtragCount: 5,
    showZeithonorar: false,
    noteColumns: DEFAULT_RECHNUNGSPLAN_NOTE_COLUMNS.map((n) => ({ ...n })),
    rows: [],
  }
}

// Key used in KV + API path: e.g. "2026-11".
export function rechnungsplanKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

// --- Mitarbeiter (Roster) module -----------------------------------------
// Standalone employee + team directory. Not wired into QuartalPlanTable yet —
// that view keeps its own Employee list for now. PMs define their own teams
// here and assign employees to them.

export type RosterLocation = {
  id: string
  name: string
}

export type RosterTeam = {
  id: string
  name: string
  // Country the team belongs to. undefined = not yet assigned.
  locationId?: string
  // Optional CSS color (hex) used as a tag chip; falls back to a neutral
  // grey when empty.
  color?: string
}

export type RosterEmployee = {
  id: string
  vorname: string
  name: string
  teamId?: string // undefined = not yet assigned to a team
  // Login fields — all optional. A roster entry with kuerzel + password set
  // can sign in; without them the person exists only as roster/HR data.
  kuerzel?: string
  personalnummer?: string
  password?: string
  roleId?: string
}

export type Roster = {
  locations: RosterLocation[]
  teams: RosterTeam[]
  employees: RosterEmployee[]
}

export function emptyRoster(): Roster {
  return { locations: [], teams: [], employees: [] }
}

// --- Access control (role-based: role name + password → modules) ----------

export type ModuleId =
  | 'ziele_dashboard'
  | 'ziele_teams'
  | 'ziele_kontrolle'
  | 'dashboard'
  | 'forecast'
  | 'plan'
  | 'plan_overview'
  | 'rechnungen'
  | 'ks_bauwerke'
  | 'ks_hoai'
  | 'ks_katalog'
  | 'mitarbeiter'
  | 'settings'

export const MODULES: ModuleId[] = [
  'ziele_dashboard',
  'ziele_teams',
  'ziele_kontrolle',
  'dashboard',
  'forecast',
  'plan',
  'plan_overview',
  'rechnungen',
  'ks_bauwerke',
  'ks_hoai',
  'ks_katalog',
  'mitarbeiter',
  'settings',
]

export const MODULE_LABELS: Record<ModuleId, string> = {
  dashboard: 'Dashboard',
  forecast: 'Forecast',
  plan: 'Quartalsplanung',
  plan_overview: 'Quartalsplanung (nur Übersicht)',
  ziele_dashboard: 'Dashboard',
  ziele_teams: 'Teams',
  ziele_kontrolle: 'Zielkontrolle',
  rechnungen: 'Rechnungen',
  ks_bauwerke: 'Bauwerke',
  ks_hoai: 'HOAI-Honorar',
  ks_katalog: 'Datenbank Ril 808',
  mitarbeiter: 'Mitarbeiter',
  settings: 'Einstellungen',
}

// Module grouping mirrors the sidebar structure so the Rollen settings read
// "parent module, then its sub-modules". Chips rendered group-by-group make
// it easier for admins to scan "who has which group" at a glance.
export const MODULE_GROUPS: { label: string; modules: ModuleId[] }[] = [
  { label: 'Ziele', modules: ['ziele_dashboard', 'ziele_teams', 'ziele_kontrolle'] },
  { label: 'Operative Planung', modules: ['dashboard', 'forecast', 'plan', 'plan_overview'] },
  { label: 'Rechnungen', modules: ['rechnungen'] },
  { label: 'Kostenschätzung', modules: ['ks_bauwerke', 'ks_hoai', 'ks_katalog'] },
  { label: 'Einstellungen', modules: ['mitarbeiter', 'settings'] },
]

// Backwards compatibility: expand deprecated coarse IDs ('ziele', 'umsatz',
// 'kostenschaetzung') to their fine-grained children so stored role data
// keeps working. Called when loading access config from KV / mock.
const KNOWN_MODULES = new Set<string>(MODULES)
export function migrateModuleIds(mods: string[]): ModuleId[] {
  const out = new Set<ModuleId>()
  for (const m of mods) {
    if (m === 'ziele') {
      out.add('ziele_dashboard')
      out.add('ziele_teams')
    } else if (m === 'umsatz') {
      out.add('ziele_dashboard')
      out.add('ziele_kontrolle')
    } else if (m === 'kostenschaetzung') {
      out.add('ks_bauwerke')
      out.add('ks_hoai')
      out.add('ks_katalog')
    } else if (KNOWN_MODULES.has(m)) {
      out.add(m as ModuleId)
    }
  }
  return Array.from(out)
}

export type Role = {
  id: string
  name: string
  // Password kept for backwards-compat shared-role sign-in; deprecated in favour
  // of per-user logins. Empty string means role-login is disabled.
  password: string
  modules: ModuleId[]
}

export type User = {
  id: string
  vorname: string
  name: string
  kuerzel: string // doubles as the login username
  personalnummer: string
  password: string
  roleId: string // references Role.id
}

export type AccessConfig = {
  roles: Role[]
  users: User[]
}

export function displayUserName(u: Pick<User, 'vorname' | 'name' | 'kuerzel'>): string {
  const parts = [u.vorname, u.name].filter((s) => s.trim().length > 0)
  return parts.length > 0 ? parts.join(' ') : u.kuerzel || 'Unbenannt'
}

// Preset role templates the admin starts with (name + sensible default modules).
// They can rename / delete / add new. Admin picks these by clicking a chip in
// the new-role form and the module checkboxes auto-fill.
export type RolePreset = { name: string; modules: ModuleId[] }

export const PRESET_ROLES: RolePreset[] = [
  {
    name: 'GF und Teamleiter',
    modules: ['dashboard', 'forecast', 'plan', 'ziele_dashboard', 'ziele_teams', 'ziele_kontrolle', 'rechnungen', 'ks_bauwerke', 'ks_hoai', 'ks_katalog', 'mitarbeiter', 'settings'],
  },
  {
    name: 'Verwaltung',
    modules: ['dashboard', 'forecast', 'plan', 'ziele_dashboard', 'ziele_teams', 'ziele_kontrolle', 'rechnungen', 'ks_bauwerke', 'ks_hoai', 'ks_katalog', 'mitarbeiter'],
  },
  {
    name: 'Projektleiter',
    modules: ['dashboard', 'forecast', 'plan', 'rechnungen', 'ks_bauwerke', 'ks_hoai', 'ks_katalog', 'mitarbeiter'],
  },
  { name: 'Projektingenieur', modules: ['plan_overview'] },
  { name: 'Konstrukteur', modules: ['plan_overview'] },
  { name: 'Azubis', modules: ['plan_overview'] },
  { name: 'Werkstudenten', modules: ['plan_overview'] },
]

// Legacy export some callers still use for the name list only.
export const PRESET_ROLE_NAMES = PRESET_ROLES.map((p) => p.name)

export function emptyAccessConfig(): AccessConfig {
  return { roles: [], users: [] }
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
