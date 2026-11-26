import type {
  AccessConfig,
  ActivityEvent,
  Period,
  ProjektlisteDoc,
  QuartalPlan,
  Rechnungsplan,
  Roster,
  Umsatzkontrolle,
  Ziele,
} from './types'
import { rechnungsplanKey } from './types'
import { mock } from './mock'

// Auth is a session cookie (HttpOnly, set by /api/auth/*); the browser sends
// it automatically on same-origin requests, so no credentials live in JS.
function headers(): HeadersInit {
  return { 'content-type': 'application/json' }
}

export type SessionUser = {
  id: string
  email: string
  displayName: string
  emailVerified: boolean
  status: 'active' | 'disabled'
  employeeId: string | null
  kuerzel: string | null
  role: { id: string; name: string; modules: string[] } | null
}

// Error carrying the server's German message for display in forms.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

async function authPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? data.error ?? `Fehler ${res.status}`)
  return data as T
}

const MOCK_USER: SessionUser = {
  id: 'mock-admin',
  email: 'admin@example.com',
  displayName: 'Dev Admin',
  emailVerified: true,
  status: 'active',
  employeeId: null,
  kuerzel: 'DEV',
  role: null,
}

export async function fetchMe(): Promise<SessionUser | null> {
  if (mock.isDev) {
    const role = mock.access()?.roles[0]
    return { ...MOCK_USER, role: role ? { id: role.id, name: role.name, modules: role.modules } : null }
  }
  const res = await fetch('/api/auth/me', { headers: headers() })
  if (!res.ok) throw new Error(`me failed: ${res.status}`)
  return ((await res.json()) as { user: SessionUser | null }).user
}

export const auth = {
  login: (email: string, password: string) =>
    authPost<{ user: SessionUser }>('/api/auth/login', { email, password }),
  register: (email: string, password: string, displayName: string) =>
    authPost<{ ok: true; verificationRequired: boolean; user?: SessionUser }>('/api/auth/register', {
      email,
      password,
      displayName,
    }),
  config: async (): Promise<{ passwordReset: boolean }> => {
    if (mock.isDev) return { passwordReset: true }
    const res = await fetch('/api/auth/config', { headers: headers() })
    return res.ok ? ((await res.json()) as { passwordReset: boolean }) : { passwordReset: true }
  },
  verifyEmail: (token: string) => authPost<{ user: SessionUser }>('/api/auth/verify-email', { token }),
  resendVerification: (email: string) => authPost<{ ok: true }>('/api/auth/resend-verification', { email }),
  forgotPassword: (email: string) => authPost<{ ok: true }>('/api/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    authPost<{ user: SessionUser }>('/api/auth/reset-password', { token, password }),
  legacyLogin: (kuerzel: string, password: string) =>
    authPost<{ claimToken: string; displayName: string; kuerzel: string | null; roleName?: string }>(
      '/api/auth/legacy-login',
      { kuerzel, password },
    ),
  claim: (claimToken: string, email: string, password: string, displayName: string) =>
    authPost<{ user: SessionUser }>('/api/auth/claim', { claimToken, email, password, displayName }),
  logout: () => (mock.isDev ? Promise.resolve({ ok: true }) : authPost<{ ok: true }>('/api/auth/logout', {})),
}

// --- Account administration (Einstellungen) --------------------------------

export type Account = {
  id: string
  email: string
  displayName: string
  emailVerified: boolean
  status: 'active' | 'disabled'
  roleId: string | null
  employeeId: string | null
  createdAt: string
  lastLoginAt: string | null
}
export type AccountEmployee = { id: string; label: string; kuerzel: string | null; roleId: string | null }
export type AccountsResponse = {
  accounts: Account[]
  employees: AccountEmployee[]
  pendingLegacy: { kuerzel: string; displayName: string }[]
}

export async function fetchAccounts(): Promise<AccountsResponse> {
  if (mock.isDev) return { accounts: [], employees: [], pendingLegacy: [] }
  const res = await fetch('/api/settings/accounts', { headers: headers() })
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as AccountsResponse
}

export async function updateAccount(
  id: string,
  patch: Partial<Pick<Account, 'roleId' | 'employeeId' | 'status' | 'displayName'>>,
): Promise<void> {
  const res = await fetch(`/api/settings/accounts/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new ApiError(res.status, data.error ?? 'error', data.message ?? `Fehler ${res.status}`)
  }
}

export async function deleteAccount(id: string): Promise<void> {
  const res = await fetch(`/api/settings/accounts/${id}`, { method: 'DELETE', headers: headers() })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new ApiError(res.status, data.error ?? 'error', data.message ?? `Fehler ${res.status}`)
  }
}

// --- Module documents: versioned reads/writes -------------------------------
// The server returns each document's version (x-doc-version). Saves send the
// version they are based on; if someone else saved in between, the server
// refuses (409) instead of overwriting, keeps the rejected copy, and we tell
// the UI so the user can reload the current data.

const DOC_VERSION = 'x-doc-version'
const docVersions = new Map<string, string>()
const saveQueues = new Map<string, Promise<unknown>>()

export const CONFLICT_EVENT = 'eo:doc-conflict'

export class ConflictError extends Error {
  constructor(public path: string) {
    super('Diese Daten wurden inzwischen von jemand anderem geändert.')
  }
}

async function docGet(path: string): Promise<Response> {
  const res = await fetch(path, { headers: headers() })
  const v = res.headers.get(DOC_VERSION)
  if (res.ok && v !== null) docVersions.set(path, v)
  return res
}

// Saves to the same document run one after another so each request carries
// the version returned by the previous one.
function docPut(path: string, body: string): Promise<Response> {
  const prev = saveQueues.get(path) ?? Promise.resolve()
  const next = prev
    .catch(() => {})
    .then(async () => {
      const v = docVersions.get(path)
      const res = await fetch(path, {
        method: 'PUT',
        headers: { ...(headers() as Record<string, string>), ...(v !== undefined ? { [DOC_VERSION]: v } : {}) },
        body,
      })
      if (res.status === 409) {
        window.dispatchEvent(new CustomEvent(CONFLICT_EVENT, { detail: { path } }))
        throw new ConflictError(path)
      }
      const nv = res.headers.get(DOC_VERSION)
      if (res.ok && nv !== null) docVersions.set(path, nv)
      return res
    })
  saveQueues.set(path, next)
  return next
}

export async function fetchPeriod(key: string): Promise<Period | null> {
  if (mock.isDev) return mock.period(key)
  const res = await docGet(`/api/period/${key}`)
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  const data = (await res.json()) as Period | null
  return data
}

export async function savePeriod(key: string, period: Period): Promise<void> {
  if (mock.isDev) {
    mock.setPeriod(key, period)
    return
  }
  const res = await docPut(`/api/period/${key}`, JSON.stringify(period))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchPlan(year: number): Promise<QuartalPlan | null> {
  if (mock.isDev) return mock.plan(year)
  const res = await docGet(`/api/plan/${year}`)
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as QuartalPlan | null
}

export async function savePlan(year: number, plan: QuartalPlan): Promise<void> {
  if (mock.isDev) {
    mock.setPlan(year, plan)
    return
  }
  const res = await docPut(`/api/plan/${year}`, JSON.stringify(plan))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchZiele(year: number): Promise<Ziele | null> {
  if (mock.isDev) return mock.ziele(year)
  const res = await docGet(`/api/ziele/${year}`)
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as Ziele | null
}

export async function saveZiele(year: number, ziele: Ziele): Promise<void> {
  if (mock.isDev) {
    mock.setZiele(year, ziele)
    return
  }
  const res = await docPut(`/api/ziele/${year}`, JSON.stringify(ziele))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchUmsatz(year: number): Promise<Umsatzkontrolle | null> {
  if (mock.isDev) return mock.umsatz(year)
  const res = await docGet(`/api/umsatz/${year}`)
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as Umsatzkontrolle | null
}

export async function saveUmsatz(year: number, data: Umsatzkontrolle): Promise<void> {
  if (mock.isDev) {
    mock.setUmsatz(year, data)
    return
  }
  const res = await docPut(`/api/umsatz/${year}`, JSON.stringify(data))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchRechnungsplan(
  year: number,
  month: number,
): Promise<Rechnungsplan | null> {
  if (mock.isDev) return mock.rechnungsplan(year, month)
  const key = rechnungsplanKey(year, month)
  const res = await docGet(`/api/rechnungsplan/${key}`)
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as Rechnungsplan | null
}

export async function saveRechnungsplan(
  year: number,
  month: number,
  data: Rechnungsplan,
): Promise<void> {
  if (mock.isDev) {
    mock.setRechnungsplan(year, month, data)
    return
  }
  const key = rechnungsplanKey(year, month)
  const res = await docPut(`/api/rechnungsplan/${key}`, JSON.stringify(data))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchRoster(): Promise<Roster | null> {
  if (mock.isDev) return mock.roster()
  const res = await docGet('/api/roster')
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as Roster | null
}

export async function saveRoster(data: Roster): Promise<void> {
  if (mock.isDev) {
    mock.setRoster(data)
    return
  }
  const res = await docPut('/api/roster', JSON.stringify(data))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchActivity(days = 7): Promise<ActivityEvent[]> {
  if (mock.isDev) return mock.activityList(days)
  const res = await fetch(`/api/activity?days=${days}`, { headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as ActivityEvent[]
}

export async function logActivity(event: Omit<ActivityEvent, 'ts'>): Promise<void> {
  if (mock.isDev) {
    mock.logActivity(event)
    return
  }
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(event),
    })
  } catch {
    // Fire-and-forget: never let activity tracking break a user action.
  }
}

export async function fetchProjektliste(): Promise<ProjektlisteDoc | null> {
  if (mock.isDev) return mock.projektliste()
  const res = await docGet('/api/projektliste')
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as ProjektlisteDoc | null
}

export async function saveProjektliste(data: ProjektlisteDoc): Promise<void> {
  if (mock.isDev) {
    mock.setProjektliste(data)
    return
  }
  const res = await docPut('/api/projektliste', JSON.stringify(data))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchKostenschaetzung(): Promise<unknown> {
  if (mock.isDev) return mock.kostenschaetzung()
  const res = await docGet('/api/kostenschaetzung')
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return await res.json()
}

export async function saveKostenschaetzung(data: unknown): Promise<void> {
  if (mock.isDev) {
    mock.setKostenschaetzung(data)
    return
  }
  const res = await docPut('/api/kostenschaetzung', JSON.stringify(data))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchKostenermittlung(): Promise<unknown> {
  if (mock.isDev) return mock.kostenermittlung()
  const res = await docGet('/api/kostenermittlung')
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return await res.json()
}

export async function saveKostenermittlung(data: unknown): Promise<void> {
  if (mock.isDev) {
    mock.setKostenermittlung(data)
    return
  }
  const res = await docPut('/api/kostenermittlung', JSON.stringify(data))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchUserPrefs(): Promise<unknown> {
  if (mock.isDev) return mock.userPrefs()
  const res = await docGet('/api/user-prefs')
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return await res.json()
}

export async function saveUserPrefs(data: unknown): Promise<void> {
  if (mock.isDev) {
    mock.setUserPrefs(data)
    return
  }
  const res = await docPut('/api/user-prefs', JSON.stringify(data))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchKostenermittlungImv(): Promise<unknown> {
  if (mock.isDev) return mock.kostenermittlungImv()
  const res = await docGet('/api/kostenermittlung_imv')
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return await res.json()
}

export async function saveKostenermittlungImv(data: unknown): Promise<void> {
  if (mock.isDev) {
    mock.setKostenermittlungImv(data)
    return
  }
  const res = await docPut('/api/kostenermittlung_imv', JSON.stringify(data))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchKatalogOverrides(): Promise<unknown> {
  if (mock.isDev) return mock.katalogOverrides()
  const res = await docGet('/api/katalog-overrides')
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return await res.json()
}

export async function saveKatalogOverrides(data: unknown): Promise<void> {
  if (mock.isDev) {
    mock.setKatalogOverrides(data)
    return
  }
  const res = await docPut('/api/katalog-overrides', JSON.stringify(data))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchHr(): Promise<unknown> {
  if (mock.isDev) return mock.hr()
  const res = await docGet('/api/hr')
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return await res.json()
}

export async function saveHr(data: unknown): Promise<void> {
  if (mock.isDev) {
    mock.setHr(data)
    return
  }
  const res = await docPut('/api/hr', JSON.stringify(data))
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchLogo(): Promise<string | null> {
  if (mock.isDev) return mock.logo()
  const res = await fetch('/api/logo', { headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  const data = (await res.json()) as { dataUrl: string | null }
  return data.dataUrl
}

export async function saveLogo(dataUrl: string): Promise<void> {
  if (mock.isDev) {
    mock.setLogo(dataUrl)
    return
  }
  const res = await fetch('/api/logo', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ dataUrl }),
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (res.status === 413) throw new Error('Datei zu groß (max. ~500 KB)')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchAccess(): Promise<AccessConfig | null> {
  if (mock.isDev) return mock.access()
  const res = await fetch('/api/settings/access', { headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as AccessConfig | null
}

export async function saveAccess(cfg: AccessConfig): Promise<void> {
  if (mock.isDev) {
    mock.setAccess(cfg)
    return
  }
  const res = await fetch('/api/settings/access', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(cfg),
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function deleteLogo(): Promise<void> {
  if (mock.isDev) {
    mock.setLogo(null)
    return
  }
  const res = await fetch('/api/logo', { method: 'DELETE', headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`delete failed: ${res.status}`)
}
