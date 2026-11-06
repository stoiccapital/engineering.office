import { useEffect, useState } from 'react'
import { Check, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { useAccess } from '@/access-store'
import {
  MODULES,
  MODULE_LABELS,
  PRESET_ROLES,
  type ModuleId,
  type RolePreset,
  type User,
} from '@/types'
import { cn } from '@/lib/utils'

export function Settings() {
  const roles = useAccess((s) => s.config.roles)
  const users = useAccess((s) => s.config.users)
  const currentRole = useAccess((s) => s.currentRole)
  const currentUser = useAccess((s) => s.currentUser)
  const currentRoleId = currentRole?.id ?? null
  const currentUserId = currentUser?.id ?? null
  const loadFullConfig = useAccess((s) => s.loadFullConfig)
  const addRole = useAccess((s) => s.addRole)
  const updateRole = useAccess((s) => s.updateRole)
  const removeRole = useAccess((s) => s.removeRole)
  const addUser = useAccess((s) => s.addUser)
  const updateUser = useAccess((s) => s.updateUser)
  const removeUser = useAccess((s) => s.removeUser)

  useEffect(() => {
    void loadFullConfig()
  }, [loadFullConfig])

  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newModules, setNewModules] = useState<Set<ModuleId>>(new Set(['plan']))
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  // New-user form state
  const [newU, setNewU] = useState<Omit<User, 'id'>>({
    vorname: '',
    name: '',
    kuerzel: '',
    personalnummer: '',
    password: '',
    roleId: '',
  })
  const [revealedUserPw, setRevealedUserPw] = useState<Set<string>>(new Set())

  const existingNames = new Set(roles.map((r) => r.name.toLowerCase()))
  const presetSuggestions: RolePreset[] = PRESET_ROLES.filter(
    (p) => !existingNames.has(p.name.toLowerCase()),
  )

  function applyPreset(preset: RolePreset) {
    setNewName(preset.name)
    setNewModules(new Set(preset.modules))
  }

  const canAdd = newName.trim().length > 0 && newPassword.length > 0

  const canAddUser =
    newU.kuerzel.trim().length > 0 && newU.password.length > 0 && newU.roleId.length > 0

  const existingKuerzel = new Set(users.map((u) => u.kuerzel.toLowerCase()))
  const kuerzelCollision =
    newU.kuerzel.trim().length > 0 && existingKuerzel.has(newU.kuerzel.trim().toLowerCase())

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleRevealUser(id: string) {
    setRevealedUserPw((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAdd() {
    if (!canAdd) return
    addRole(newName, newPassword, Array.from(newModules))
    setNewName('')
    setNewPassword('')
    setNewModules(new Set(['plan']))
  }

  function handleAddUser() {
    if (!canAddUser || kuerzelCollision) return
    void addUser({
      vorname: newU.vorname.trim(),
      name: newU.name.trim(),
      kuerzel: newU.kuerzel.trim(),
      personalnummer: newU.personalnummer.trim(),
      password: newU.password,
      roleId: newU.roleId,
    })
    setNewU({
      vorname: '',
      name: '',
      kuerzel: '',
      personalnummer: '',
      password: '',
      roleId: '',
    })
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
    const isCurrentRole = roleId === currentRoleId
    const isSettings = mod === 'settings'
    const willRemove = currentModules.includes(mod)
    if (isCurrentRole && isSettings && willRemove) {
      alert('Du kannst dir nicht selbst den Zugriff auf Einstellungen nehmen.')
      return
    }
    const next = willRemove
      ? currentModules.filter((m) => m !== mod)
      : [...currentModules, mod]
    updateRole(roleId, { modules: next })
  }

  function handleRemove(roleId: string, roleName: string) {
    if (roleId === currentRoleId && !currentUser) {
      alert('Du kannst deine eigene Rolle nicht löschen.')
      return
    }
    if (confirm(`Rolle "${roleName}" löschen?`)) removeRole(roleId)
  }

  function handleRemoveUser(userId: string, display: string) {
    if (userId === currentUserId) {
      alert('Du kannst deinen eigenen Benutzer nicht löschen.')
      return
    }
    if (confirm(`Benutzer "${display}" löschen?`)) removeUser(userId)
  }

  return (
    <div className="space-y-6">
      <Section
        title="Neuer Benutzer"
        subtitle="Jede Person bekommt einen eigenen Login. Login-Name ist das Kürzel (z. B. MuA). Rolle steuert die sichtbaren Module."
      >
        <div className="grid gap-3 md:grid-cols-6">
          <FormField label="Vorname">
            <input
              value={newU.vorname}
              onChange={(e) => setNewU((s) => ({ ...s, vorname: e.target.value }))}
              placeholder="Alberon"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </FormField>
          <FormField label="Name">
            <input
              value={newU.name}
              onChange={(e) => setNewU((s) => ({ ...s, name: e.target.value }))}
              placeholder="Mulaj"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </FormField>
          <FormField label="Kürzel">
            <input
              value={newU.kuerzel}
              onChange={(e) => setNewU((s) => ({ ...s, kuerzel: e.target.value }))}
              placeholder="MuA"
              className={cn(
                'w-full rounded-md border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-ring',
                kuerzelCollision && 'border-destructive/60',
              )}
            />
            {kuerzelCollision && (
              <div className="mt-0.5 text-[10px] text-destructive">
                Kürzel bereits vergeben
              </div>
            )}
          </FormField>
          <FormField label="Personalnummer">
            <input
              value={newU.personalnummer}
              onChange={(e) => setNewU((s) => ({ ...s, personalnummer: e.target.value }))}
              placeholder="P-0014"
              className="w-full rounded-md border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </FormField>
          <FormField label="Rolle">
            <select
              value={newU.roleId}
              onChange={(e) => setNewU((s) => ({ ...s, roleId: e.target.value }))}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— auswählen —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Passwort">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newU.password}
                onChange={(e) => setNewU((s) => ({ ...s, password: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                placeholder="•••••••••"
                className="w-full rounded-md border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleAddUser}
                disabled={!canAddUser || kuerzelCollision}
                className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Anlegen
              </button>
            </div>
          </FormField>
        </div>
      </Section>

      <Section
        title="Benutzer"
        subtitle={`${users.length} ${users.length === 1 ? 'Benutzer' : 'Benutzer'}`}
        padded={false}
      >
        {users.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Keine Benutzer angelegt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">Vorname</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Kürzel</th>
                  <th className="px-3 py-2 text-left">Personalnummer</th>
                  <th className="px-3 py-2 text-left">Rolle</th>
                  <th className="px-3 py-2 text-left">Passwort</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isMe = u.id === currentUserId
                  const show = revealedUserPw.has(u.id)
                  const roleMissing = !roles.find((r) => r.id === u.roleId)
                  return (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <input
                          value={u.vorname}
                          onChange={(e) => updateUser(u.id, { vorname: e.target.value })}
                          className="w-full rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                        />
                        {isMe && (
                          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Du
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={u.name}
                          onChange={(e) => updateUser(u.id, { name: e.target.value })}
                          className="w-full rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={u.kuerzel}
                          onChange={(e) => updateUser(u.id, { kuerzel: e.target.value })}
                          className="w-full rounded border bg-background px-2 py-1 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={u.personalnummer}
                          onChange={(e) =>
                            updateUser(u.id, { personalnummer: e.target.value })
                          }
                          className="w-full rounded border bg-background px-2 py-1 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={u.roleId}
                          onChange={(e) => updateUser(u.id, { roleId: e.target.value })}
                          className={cn(
                            'w-full rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring',
                            roleMissing && 'border-destructive/60 text-destructive',
                          )}
                        >
                          <option value="">— keine —</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type={show ? 'text' : 'password'}
                            value={u.password}
                            onChange={(e) => updateUser(u.id, { password: e.target.value })}
                            className="w-full rounded border bg-background px-2 py-1 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
                          />
                          <button
                            onClick={() => toggleRevealUser(u.id)}
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            title={show ? 'Verbergen' : 'Anzeigen'}
                          >
                            {show ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() =>
                            handleRemoveUser(u.id, `${u.vorname} ${u.name}`.trim() || u.kuerzel)
                          }
                          disabled={isMe}
                          className={cn(
                            'rounded p-1 transition-colors',
                            isMe
                              ? 'cursor-not-allowed text-muted-foreground/40'
                              : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                          )}
                          title={
                            isMe
                              ? 'Eigener Benutzer kann nicht gelöscht werden'
                              : 'Löschen'
                          }
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

      <Section
        title="Neue Rolle"
        subtitle="Name, Passwort und sichtbare Module. Die Rolle mit Einstellungen ist Admin."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Rollenname
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z. B. Projektleiter"
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              {presetSuggestions.length > 0 && !newName && (
                <div className="mt-1.5 flex flex-wrap gap-1">
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
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="•••••••••"
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Anlegen
            </button>
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
        subtitle={`${roles.length} ${roles.length === 1 ? 'Rolle' : 'Rollen'} · Permission-Gruppen`}
        padded={false}
      >
        {roles.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Keine Rollen angelegt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">Rolle</th>
                  <th className="px-3 py-2 text-left">Passwort</th>
                  {MODULES.map((m) => (
                    <th key={m} className="px-2 py-2 text-center">
                      {MODULE_LABELS[m]}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => {
                  const allowed = new Set(r.modules)
                  const isMe = r.id === currentRoleId && !currentUser
                  const show = revealed.has(r.id)
                  return (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <input
                          value={r.name}
                          onChange={(e) => updateRole(r.id, { name: e.target.value })}
                          className="w-full rounded border bg-background px-2 py-1 text-sm font-medium outline-none focus:ring-1 focus:ring-ring"
                        />
                        {isMe && (
                          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Du
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type={show ? 'text' : 'password'}
                            value={r.password}
                            onChange={(e) => updateRole(r.id, { password: e.target.value })}
                            className="w-full rounded border bg-background px-2 py-1 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
                          />
                          <button
                            onClick={() => toggleReveal(r.id)}
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            title={show ? 'Verbergen' : 'Anzeigen'}
                          >
                            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      {MODULES.map((m) => {
                        const on = allowed.has(m)
                        const lockedForMe = isMe && m === 'settings' && on
                        return (
                          <td key={m} className="px-2 py-2 text-center">
                            <button
                              onClick={() => toggleRoleModule(r.id, m, r.modules)}
                              disabled={lockedForMe}
                              title={lockedForMe ? 'Du kannst dir Einstellungen nicht selbst entziehen' : undefined}
                              className={cn(
                                'inline-flex h-6 w-6 items-center justify-center rounded border transition-colors',
                                on
                                  ? 'border-foreground bg-foreground text-background'
                                  : 'border-border bg-background text-transparent hover:bg-accent',
                                lockedForMe && 'cursor-not-allowed opacity-60',
                              )}
                              aria-label={`${MODULE_LABELS[m]} für ${r.name}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleRemove(r.id, r.name)}
                          disabled={isMe}
                          className={cn(
                            'rounded p-1 transition-colors',
                            isMe
                              ? 'cursor-not-allowed text-muted-foreground/40'
                              : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                          )}
                          title={isMe ? 'Eigene Rolle kann nicht gelöscht werden' : 'Löschen'}
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
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  )
}
