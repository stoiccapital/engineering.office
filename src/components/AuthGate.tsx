import { useEffect, useState } from 'react'
import { checkAuth, getToken, setToken, clearToken } from '@/api'

type Status = 'checking' | 'needs-login' | 'authed'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = getToken()
    if (!t) {
      setStatus('needs-login')
      return
    }
    checkAuth(t).then((ok) => {
      if (ok) setStatus('authed')
      else {
        clearToken()
        setStatus('needs-login')
      }
    })
  }, [])

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Lade…
      </div>
    )
  }

  if (status === 'needs-login') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            const ok = await checkAuth(input)
            setBusy(false)
            if (ok) {
              setToken(input)
              setStatus('authed')
            } else {
              setError('Falsches Passwort')
            }
          }}
          className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6"
        >
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ingenieurbüro Merkin &amp; Völker
            </div>
            <h1 className="text-lg font-semibold">Forecast</h1>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Passwort</label>
            <input
              type="password"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="•••••••••"
            />
            {error && <div className="text-xs text-destructive">{error}</div>}
          </div>
          <button
            type="submit"
            disabled={busy || !input}
            className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {busy ? 'Prüfe…' : 'Anmelden'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
