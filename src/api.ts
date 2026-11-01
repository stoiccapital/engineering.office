import type { Period, QuartalPlan, Umsatzkontrolle, Ziele } from './types'
import { mock } from './mock'

const TOKEN_KEY = 'forecast-token'

if (mock.isDev && !localStorage.getItem(TOKEN_KEY)) {
  localStorage.setItem(TOKEN_KEY, 'dev-mock')
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function headers(): HeadersInit {
  const t = getToken() ?? ''
  return { 'content-type': 'application/json', authorization: `Bearer ${t}` }
}

export async function checkAuth(token: string): Promise<boolean> {
  if (mock.isDev) return Boolean(token)
  const res = await fetch('/api/auth-check', {
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  })
  return res.ok
}

export async function fetchPeriod(key: string): Promise<Period | null> {
  if (mock.isDev) return mock.period(key)
  const res = await fetch(`/api/period/${key}`, { headers: headers() })
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
  const res = await fetch(`/api/period/${key}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(period),
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchPlan(year: number): Promise<QuartalPlan | null> {
  if (mock.isDev) return mock.plan(year)
  const res = await fetch(`/api/plan/${year}`, { headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as QuartalPlan | null
}

export async function savePlan(year: number, plan: QuartalPlan): Promise<void> {
  if (mock.isDev) {
    mock.setPlan(year, plan)
    return
  }
  const res = await fetch(`/api/plan/${year}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(plan),
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchZiele(year: number): Promise<Ziele | null> {
  if (mock.isDev) return mock.ziele(year)
  const res = await fetch(`/api/ziele/${year}`, { headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as Ziele | null
}

export async function saveZiele(year: number, ziele: Ziele): Promise<void> {
  if (mock.isDev) {
    mock.setZiele(year, ziele)
    return
  }
  const res = await fetch(`/api/ziele/${year}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(ziele),
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchUmsatz(year: number): Promise<Umsatzkontrolle | null> {
  if (mock.isDev) return mock.umsatz(year)
  const res = await fetch(`/api/umsatz/${year}`, { headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as Umsatzkontrolle | null
}

export async function saveUmsatz(year: number, data: Umsatzkontrolle): Promise<void> {
  if (mock.isDev) {
    mock.setUmsatz(year, data)
    return
  }
  const res = await fetch(`/api/umsatz/${year}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(data),
  })
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

export async function deleteLogo(): Promise<void> {
  if (mock.isDev) {
    mock.setLogo(null)
    return
  }
  const res = await fetch('/api/logo', { method: 'DELETE', headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`delete failed: ${res.status}`)
}
