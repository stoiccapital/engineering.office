import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Plus, Trash2, Undo2 } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/access-store'
import {
  MODULES,
  MODULE_LABELS,
  PRESET_ROLES,
  type ModuleId,
  type Role,
  type RolePreset,
} from '@/types'
import { cn } from '@/lib/utils'

const UNDO_MS = 5000

export function Settings() {
  const roles = useAccess((s) => s.config.roles)
  const currentRole = useAccess((s) => s.currentRole)
  const currentUser = useAccess((s) => s.currentUser)
  const currentRoleId = currentRole?.id ?? null
  const loadFullConfig = useAccess((s) => s.loadFullConfig)
  const addRole = useAccess((s) => s.addRole)
  const updateRole = useAccess((s) => s.updateRole)
  const removeRole = useAccess((s) => s.removeRole)

  useEffect(() => {
    void loadFullConfig()
  }, [loadFullConfig])

  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordVisible, setNewPasswordVisible] = useState(false)
  const [newModules, setNewModules] = useState<Set<ModuleId>>(new Set(['plan']))
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  // Deferred delete with undo window — the store is not touched until the
  // timer fires, so undo is purely local state.
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, Role>>({})
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    return () => {
      for (const t of Object.values(timers.current)) clearTimeout(t)
    }
  }, [])

  const existingNames = new Set(roles.map((r) => r.name.toLowerCase()))
  const presetSuggestions: RolePreset[] = PRESET_ROLES.filter(
    (p) => !existingNames.has(p.name.toLowerCase()),
  )

  const canAdd = newName.trim().length > 0 && newPassword.length > 0

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function applyPreset(preset: RolePreset) {
    setNewName(preset.name)
    setNewModules(new Set(preset.modules))
  }

  function handleAdd() {
    if (!canAdd) return
    void addRole(newName, newPassword, Array.from(newModules))
    setNewName('')
    setNewPassword('')
    setNewPasswordVisible(false)
    setNewModules(new Set(['plan']))
  }

  function toggleNewModule(m: ModuleId) {
    setNewModules((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  function toggleRoleModule(roleId: string, mod: ModuleId, currentModules: ModuleId[]) {
    const willRemove = currentModules.includes(mod)
    const next = willRemove
      ? currentModules.filter((m) => m !== mod)
      : [...currentModules, mod]
    updateRole(roleId, { modules: next })
  }

  function softDelete(role: Role) {
    // Hold a snapshot so an undo can restore state without hitting the server.
    setPendingDeletes((p) => ({ ...p, [role.id]: role }))
    timers.current[role.id] = setTimeout(() => {
      delete timers.current[role.id]
      setPendingDeletes((p) => {
        if (!p[role.id]) return p
        const next = { ...p }
        delete next[role.id]
        return next
      })
      removeRole(role.id)
    }, UNDO_MS)
  }

  function undoDelete(id: string) {
    const t = timers.current[id]
    if (t) {
      clearTimeout(t)
      delete timers.current[id]
    }
    setPendingDeletes((p) => {
      const next = { ...p }
      delete next[id]
      return next
    })
  }

  const visibleRoles = roles.filter((r) => !pendingDeletes[r.id])
  const pending = Object.values(pendingDeletes)

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-sky-500/30 bg-sky-50 px-4 py-2.5 text-xs text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
        Benutzer werden jetzt im Modul{' '}
        <strong className="font-semibold">Mitarbeiter</strong> gepflegt (Login-Felder
        pro Person, nicht mehr hier). Die Rollen-Tabelle unten bleibt — sie steuert
        welche Module eine Rolle sieht.
      </div>

      <Section
        title="Neue Rolle"
        subtitle="Name, Passwort und sichtbare Module. Die Rolle mit Einstellungen ist Admin."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Rollenname
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z. B. Projektleiter"
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              {presetSuggestions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Vorlagen:
                  </span>
                  {presetSuggestions.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => applyPreset(p)}
                      className="rounded border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                      title={`Modulvorlage: ${p.modules.map((m) => MODULE_LABELS[m]).join(', ')}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="min-w-[180px]">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Passwort
              </label>
              <div className="mt-1 flex items-center gap-1">
                <input
                  type={newPasswordVisible ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="Passwort"
                  className="w-full rounded-md border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setNewPasswordVisible((v) => !v)}
                  className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={newPasswordVisible ? 'Verbergen' : 'Anzeigen'}
                >
                  {newPasswordVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <Button onClick={handleAdd} disabled={!canAdd}>
              <Plus className="mr-1 h-4 w-4" />
              Anlegen
            </Button>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Sichtbare Module
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MODULES.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleNewModule(m)}
                  className={cn(
                    'rounded border px-2 py-1 text-xs font-medium transition-colors',
                    newModules.has(m)
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent',
                  )}
                >
                  {MODULE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Rollen"
        subtitle={`${visibleRoles.length} ${visibleRoles.length === 1 ? 'Rolle' : 'Rollen'} · Zugriff pro Modul`}
        padded={false}
      >
        {visibleRoles.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Keine Rollen angelegt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="w-48 px-3 py-2 text-left">Rolle</th>
                  <th className="w-52 px-3 py-2 text-left">Passwort</th>
                  <th className="px-3 py-2 text-left">Modulzugriff</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleRoles.map((r) => {
                  const allowed = new Set(r.modules)
                  const isMe = r.id === currentRoleId && !currentUser
                  const show = revealed.has(r.id)
                  return (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <input
                            value={r.name}
                            onChange={(e) => updateRole(r.id, { name: e.target.value })}
                            className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm font-medium outline-none focus:ring-1 focus:ring-ring"
                          />
                          {isMe && (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              Du
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-1">
                          <input
                            type={show ? 'text' : 'password'}
                            value={r.password}
                            onChange={(e) => updateRole(r.id, { password: e.target.value })}
                            className="w-full rounded border bg-background px-2 py-1 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
                          />
                          <button
                            type="button"
                            onClick={() => toggleReveal(r.id)}
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label={show ? 'Verbergen' : 'Anzeigen'}
                          >
                            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {MODULES.map((m) => {
                            const on = allowed.has(m)
                            const lockedForMe = isMe && m === 'settings' && on
                            return (
                              <button
                                key={m}
                                onClick={() => toggleRoleModule(r.id, m, r.modules)}
                                disabled={lockedForMe}
                                title={
                                  lockedForMe
                                    ? 'Du kannst dir Einstellungen nicht entziehen'
                                    : on
                                      ? `${MODULE_LABELS[m]} entziehen`
                                      : `${MODULE_LABELS[m]} vergeben`
                                }
                                aria-pressed={on}
                                className={cn(
                                  'rounded border px-2 py-0.5 text-[11px] font-medium transition-colors',
                                  on
                                    ? 'border-foreground bg-foreground text-background'
                                    : 'border-border bg-background text-muted-foreground hover:bg-accent',
                                  lockedForMe && 'cursor-not-allowed opacity-60',
                                )}
                              >
                                {MODULE_LABELS[m]}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <button
                          type="button"
                          onClick={() => softDelete(r)}
                          disabled={isMe}
                          className={cn(
                            'rounded p-1 transition-colors',
                            isMe
                              ? 'cursor-not-allowed text-muted-foreground/40'
                              : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                          )}
                          title={isMe ? 'Eigene Rolle kann nicht gelöscht werden' : 'Löschen'}
                          aria-label={`Rolle ${r.name} löschen`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {pending.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-2">
          {pending.map((r) => (
            <div
              key={r.id}
              className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-lg"
            >
              <span className="text-sm">
                Rolle <strong className="font-semibold">{r.name}</strong> gelöscht
              </span>
              <Button variant="ghost" size="sm" onClick={() => undoDelete(r.id)}>
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                Rückgängig
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
