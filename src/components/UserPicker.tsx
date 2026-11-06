import { useState } from 'react'
import { useAccess } from '@/access-store'

export function UserPicker() {
  const publicUsers = useAccess((s) => s.publicUsers)
  const publicRoles = useAccess((s) => s.publicRoles)
  const addRole = useAccess((s) => s.addRole)
  const signInAsRole = useAccess((s) => s.signInAsRole)
  const signInAsUser = useAccess((s) => s.signInAsUser)

  const isFirstBoot = publicRoles.length === 0 && publicUsers.length === 0
  const hasUsers = publicUsers.length > 0

  const [kuerzel, setKuerzel] = useState<string>('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [pickedRoleId, setPickedRoleId] = useState<string>('')

  const [newRoleName, setNewRoleName] = useState('')
  const [newRolePassword, setNewRolePassword] = useState('')

  async function handleUserLogin() {
    if (!kuerzel || !password || busy) return
    setBusy(true)
    const ok = await signInAsUser(kuerzel, password)
    setBusy(false)
    if (!ok) setError('Kürzel oder Passwort falsch')
    else setError(null)
  }

  async function handleRoleLogin() {
    if (!pickedRoleId || !password || busy) return
    setBusy(true)
    const ok = await signInAsRole(pickedRoleId, password)
    setBusy(false)
    if (!ok) setError('Falsches Passwort')
    else setError(null)
  }

  async function handleFirstBoot() {
    const name = newRoleName.trim()
    if (!name || !newRolePassword || busy) return
    setBusy(true)
    try {
      const role = await addRole(name, newRolePassword, [
        'dashboard',
        'forecast',
        'plan',
        'plan_overview',
        'ziele',
        'umsatz',
        'rechnungen',
        'settings',
      ])
      await signInAsRole(role.id, newRolePassword)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {isFirstBoot ? 'Erste Einrichtung' : 'Anmelden'}
          </div>
          <h1 className="text-lg font-semibold">
            {isFirstBoot
              ? 'Admin-Rolle anlegen'
              : hasUsers
                ? 'Benutzer wählen'
                : 'Rolle wählen'}
          </h1>
        </div>

        {isFirstBoot ? (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Rollenname
              </label>
              <input
                autoFocus
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="z. B. GF und Teamleiter"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Passwort
              </label>
              <input
                type="password"
                value={newRolePassword}
                onChange={(e) => setNewRolePassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFirstBoot()}
                placeholder="•••••••••"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Die erste Rolle ist automatisch Admin. Danach legst du in den Einstellungen
              Benutzer an — die melden sich künftig mit Kürzel + Passwort an.
            </p>
            <button
              onClick={handleFirstBoot}
              disabled={!newRoleName.trim() || !newRolePassword || busy}
              className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {busy ? 'Lege an…' : 'Anlegen und anmelden'}
            </button>
          </>
        ) : hasUsers ? (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Kürzel
              </label>
              <select
                autoFocus
                value={kuerzel}
                onChange={(e) => {
                  setKuerzel(e.target.value)
                  setError(null)
                }}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— auswählen —</option>
                {publicUsers.map((u) => (
                  <option key={u.id} value={u.kuerzel}>
                    {u.kuerzel} · {u.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleUserLogin()}
                placeholder="•••••••••"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              {error && <div className="text-xs text-destructive">{error}</div>}
            </div>
            <button
              onClick={handleUserLogin}
              disabled={!kuerzel || !password || busy}
              className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {busy ? 'Prüfe…' : 'Anmelden'}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Rolle
              </label>
              <select
                autoFocus
                value={pickedRoleId}
                onChange={(e) => {
                  setPickedRoleId(e.target.value)
                  setError(null)
                }}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— auswählen —</option>
                {publicRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleRoleLogin()}
                placeholder="•••••••••"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              {error && <div className="text-xs text-destructive">{error}</div>}
            </div>
            <p className="text-xs text-muted-foreground">
              Noch keine Benutzer angelegt — bitte als Admin-Rolle anmelden und unter
              Einstellungen Benutzer hinzufügen.
            </p>
            <button
              onClick={handleRoleLogin}
              disabled={!pickedRoleId || !password || busy}
              className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {busy ? 'Prüfe…' : 'Anmelden'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
