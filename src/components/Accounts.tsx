import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { useAccess } from '@/access-store'
import { useRoster } from '@/roster-store'
import { logActivity } from '@/activity-store'
import { auth, deleteAccount, fetchAccounts, updateAccount, type Account, type AccountsResponse } from '@/api'
import { cn } from '@/lib/utils'

const selectCls =
  'w-full rounded bg-foreground/[0.03] px-2 py-1 text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1] disabled:opacity-60'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(
    new Date(iso),
  )
}

// Email accounts: who can sign in, with which role, linked to which
// Mitarbeiter. New sign-ups appear here without a role until assigned.
export function Accounts() {
  const roles = useAccess((s) => s.config.roles)
  const me = useAccess((s) => s.currentUser)
  const [data, setData] = useState<AccountsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  // Without a mail provider nobody can confirm an address — don't flag it.
  const [mailOn, setMailOn] = useState(false)
  useEffect(() => {
    auth.config().then((c) => setMailOn(c.passwordReset), () => {})
  }, [])

  const reload = useCallback(async () => {
    try {
      setData(await fetchAccounts())
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function patch(a: Account, change: Parameters<typeof updateAccount>[1], action: string) {
    setError(null)
    try {
      await updateAccount(a.id, change)
      logActivity({ kind: 'action', action, target: a.email })
      // Linking / role changes may update the roster on the server; refresh
      // the local copy so the next Mitarbeiter edit is based on it.
      if (('employeeId' in change || 'roleId' in change) && useRoster.getState().roster) {
        void useRoster.getState().load()
      }
    } catch (e) {
      setError((e as Error).message)
    }
    await reload()
  }

  async function remove(a: Account) {
    setError(null)
    setConfirmDelete(null)
    try {
      await deleteAccount(a.id)
      logActivity({ kind: 'action', action: 'account.delete', target: a.email })
    } catch (e) {
      setError((e as Error).message)
    }
    await reload()
  }

  const accounts = data?.accounts ?? []
  const waiting = accounts.filter((a) => !a.roleId && a.status === 'active').length
  const linkedEmployees = new Set(accounts.map((a) => a.employeeId).filter(Boolean))

  return (
    <Section
      title="Konten"
      subtitle={
        data
          ? `${accounts.length} ${accounts.length === 1 ? 'Konto' : 'Konten'}${waiting ? ` · ${waiting} warten auf Freigabe` : ''}`
          : 'Lade…'
      }
      padded={false}
    >
      {error && <div className="border-b px-4 py-2 text-xs text-destructive">{error}</div>}
      {data && accounts.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground">Noch keine Konten.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left">Konto</th>
                <th className="w-52 px-3 py-2 text-left">Mitarbeiter</th>
                <th className="w-48 px-3 py-2 text-left">Rolle</th>
                <th className="w-36 px-3 py-2 text-left">Letzte Anmeldung</th>
                <th className="w-40 px-3 py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const isMe = a.id === me?.id
                return (
                  <tr key={a.id} className={cn('border-b last:border-b-0', a.status === 'disabled' && 'opacity-60')}>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">
                        {a.displayName || a.email}
                        {isMe && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Du
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">{a.email}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {mailOn && !a.emailVerified && <span className="rounded border px-1">E-Mail unbestätigt</span>}
                        {a.status === 'disabled' && <span className="rounded border px-1">Deaktiviert</span>}
                        {!a.roleId && a.status === 'active' && <span className="rounded border px-1">Wartet auf Freigabe</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <select
                        value={a.employeeId ?? ''}
                        onChange={(e) => void patch(a, { employeeId: e.target.value || null }, 'account.link')}
                        className={selectCls}
                      >
                        <option value="">— keiner —</option>
                        {data?.employees.map((emp) => (
                          <option key={emp.id} value={emp.id} disabled={emp.id !== a.employeeId && linkedEmployees.has(emp.id)}>
                            {emp.kuerzel ? `${emp.kuerzel} · ` : ''}
                            {emp.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <select
                        value={a.roleId ?? ''}
                        onChange={(e) => void patch(a, { roleId: e.target.value || null }, 'account.role')}
                        className={selectCls}
                      >
                        <option value="">— keine —</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name || 'Unbenannt'}
                          </option>
                        ))}
                      </select>
                      {a.employeeId && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">auch unter Mitarbeiter änderbar</div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground">{fmtDate(a.lastLoginAt)}</td>
                    <td className="px-3 py-2 align-top text-right">
                      {!isMe && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              void patch(
                                a,
                                { status: a.status === 'active' ? 'disabled' : 'active' },
                                a.status === 'active' ? 'account.disable' : 'account.enable',
                              )
                            }
                            className="rounded border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            {a.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
                          </button>
                          {confirmDelete === a.id ? (
                            <button
                              onClick={() => void remove(a)}
                              onBlur={() => setConfirmDelete(null)}
                              autoFocus
                              className="rounded border border-destructive px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                            >
                              Löschen?
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(a.id)}
                              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Konto löschen"
                              aria-label={`Konto ${a.email} löschen`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && data.pendingLegacy.length > 0 && (
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Noch nicht umgestellt</span> (bisheriger Kürzel-Login, noch kein
          E-Mail-Konto): {data.pendingLegacy.map((l) => l.kuerzel).join(', ')}
        </div>
      )}
    </Section>
  )
}
