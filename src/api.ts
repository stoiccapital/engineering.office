import type { Period, QuartalPlan } from './types'

const TOKEN_KEY = 'forecast-token'

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
  const res = await fetch('/api/auth-check', {
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  })
  return res.ok
}

export async function fetchPeriod(key: string): Promise<Period | null> {
  const res = await fetch(`/api/period/${key}`, { headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  const data = (await res.json()) as Period | null
  return data
}

export async function savePeriod(key: string, period: Period): Promise<void> {
  const res = await fetch(`/api/period/${key}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(period),
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchPlan(year: number): Promise<QuartalPlan | null> {
  const res = await fetch(`/api/plan/${year}`, { headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return (await res.json()) as QuartalPlan | null
}

export async function savePlan(year: number, plan: QuartalPlan): Promise<void> {
  const res = await fetch(`/api/plan/${year}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(plan),
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
}

export async function fetchLogo(): Promise<string | null> {
  const res = await fetch('/api/logo', { headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  const data = (await res.json()) as { dataUrl: string | null }
  return data.dataUrl
}

export async function saveLogo(dataUrl: string): Promise<void> {
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
  const res = await fetch('/api/logo', { method: 'DELETE', headers: headers() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`delete failed: ${res.status}`)
}
