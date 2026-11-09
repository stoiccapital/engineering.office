import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { LoadingCard } from '@/components/ui/loading-card'
import { Num } from '@/components/ui/num'
import { useRoster } from '@/roster-store'
import { useAccess } from '@/access-store'
import type { Role, RosterEmployee, RosterTeam } from '@/types'
import { cn } from '@/lib/utils'

export function Mitarbeiter() {
  const roster = useRoster((s) => s.roster)
  const load = useRoster((s) => s.load)
  const addLocation = useRoster((s) => s.addLocation)
  const updateLocation = useRoster((s) => s.updateLocation)
  const removeLocation = useRoster((s) => s.removeLocation)
  const addTeam = useRoster((s) => s.addTeam)
  const updateTeam = useRoster((s) => s.updateTeam)
  const removeTeam = useRoster((s) => s.removeTeam)
  const addEmployee = useRoster((s) => s.addEmployee)
  const updateEmployee = useRoster((s) => s.updateEmployee)
  const removeEmployee = useRoster((s) => s.removeEmployee)
  const roles = useAccess((s) => s.config.roles)
  const legacyUsers = useAccess((s) => s.config.users)
  const loadFullConfig = useAccess((s) => s.loadFullConfig)
  const clearLegacyUsers = useAccess((s) => s.clearLegacyUsers)
  const currentUser = useAccess((s) => s.currentUser)
  const clearAllLogins = useRoster((s) => s.clearAllLogins)
  const [revealedPw, setRevealedPw] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!roster) void load()
  }, [roster, load])

  // Admins can see the full role list to assign roles to roster employees.
  useEffect(() => {
    if (roles.length === 0) void loadFullConfig()
  }, [roles.length, loadFullConfig])

  function toggleRevealPw(id: string) {
    setRevealedPw((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const grouped = useMemo(() => {
    if (!roster) return { byTeam: new Map<string, RosterEmployee[]>(), unassigned: [] as RosterEmployee[] }
    const byTeam = new Map<string, RosterEmployee[]>()
    const unassigned: RosterEmployee[] = []
    for (const e of roster.employees) {
      if (e.teamId && roster.teams.some((t) => t.id === e.teamId)) {
        const list = byTeam.get(e.teamId) ?? []
        list.push(e)
        byTeam.set(e.teamId, list)
      } else {
        unassigned.push(e)
      }
    }
    return { byTeam, unassigned }
  }, [roster])

  if (!roster) return <LoadingCard>Lade Mitarbeiter…</LoadingCard>

  return (
    <div className="space-y-6">
      <Section
        title="Standorte"
        subtitle={
          <>
            <Num>{roster.locations.length}</Num>{' '}
            {roster.locations.length === 1 ? 'Standort' : 'Standorte'}
          </>
        }
        action={
          <button
            onClick={() => addLocation('')}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Standort
          </button>
        }
        padded={false}
      >
        {roster.locations.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Noch keine Standorte angelegt. Teams werden unten einem Standort zugeordnet.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="num w-28 px-3 py-2 text-right">Teams</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {roster.locations.map((l) => {
                const teamCount = roster.teams.filter((t) => t.locationId === l.id).length
                return (
                  <tr key={l.id} className="group border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <input
                        value={l.name}
                        onChange={(e) => updateLocation(l.id, { name: e.target.value })}
                        placeholder="Standort…"
                        className="w-full rounded bg-foreground/[0.03] px-2 py-1 text-sm font-medium outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
                      />
                    </td>
                    <td className="num px-3 py-2 text-right font-mono tabular-nums text-xs text-muted-foreground">
                      {teamCount}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Standort "${l.name || 'Unbenannt'}" löschen?`)) removeLocation(l.id)
                        }}
                        className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Teams"
        subtitle={
          <>
            <Num>{roster.teams.length}</Num> {roster.teams.length === 1 ? 'Team' : 'Teams'}
          </>
        }
        action={
          <button
            onClick={() => addTeam('')}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Team
          </button>
        }
        padded={false}
      >
        {roster.teams.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Noch keine Teams angelegt.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left">Teamname</th>
                <th className="w-40 px-3 py-2 text-left">Standort</th>
                <th className="w-32 px-3 py-2 text-left">Farbe</th>
                <th className="num w-28 px-3 py-2 text-right">Mitarbeiter</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {roster.teams.map((t) => {
                const count = grouped.byTeam.get(t.id)?.length ?? 0
                const locationMissing = !!t.locationId && !roster.locations.some((l) => l.id === t.locationId)
                return (
                  <tr key={t.id} className="group border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <input
                        value={t.name}
                        onChange={(e) => updateTeam(t.id, { name: e.target.value })}
                        placeholder="Team…"
                        className="w-full rounded bg-foreground/[0.03] px-2 py-1 text-sm font-medium outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={t.locationId ?? ''}
                        onChange={(e) => updateTeam(t.id, { locationId: e.target.value || undefined })}
                        className={cn(
                          'w-full rounded bg-foreground/[0.03] px-2 py-1 text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]',
                          locationMissing && 'text-destructive',
                        )}
                      >
                        <option value="">— ohne —</option>
                        {roster.locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name || 'Unbenannt'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={t.color ?? '#9ca3af'}
                          onChange={(e) => updateTeam(t.id, { color: e.target.value })}
                          className="h-6 w-8 cursor-pointer rounded border bg-background"
                        />
                        {t.color && (
                          <button
                            onClick={() => updateTeam(t.id, { color: undefined })}
                            className="text-[10px] text-muted-foreground/60 hover:text-destructive"
                            title="Farbe entfernen"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="num px-3 py-2 text-right font-mono tabular-nums text-xs text-muted-foreground">
                      {count}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Team "${t.name || 'Unbenannt'}" löschen?`)) removeTeam(t.id)
                        }}
                        className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Mitarbeiter"
        subtitle={
          <>
            <Num>{roster.employees.length}</Num>{' '}
            {roster.employees.length === 1 ? 'Mitarbeiter' : 'Mitarbeiter'}
            {grouped.unassigned.length > 0 && (
              <>
                {' '}· <Num>{grouped.unassigned.length}</Num> ohne Team
              </>
            )}
          </>
        }
        action={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const otherLogins =
                  roster.employees.filter((e) => e.kuerzel && e.id !== currentUser?.id).length +
                  legacyUsers.filter((u) => u.id !== currentUser?.id).length
                if (otherLogins === 0) {
                  alert('Außer dir sind keine weiteren Logins aktiv.')
                  return
                }
                const ok = confirm(
                  `Alle anderen Logins (${otherLogins}) zurücksetzen? Kürzel, Passwort, Personalnr. und Rolle werden auf diesen Mitarbeiter-Zeilen gelöscht. Dein eigener Login bleibt.`,
                )
                if (!ok) return
                clearAllLogins(currentUser?.id)
                clearLegacyUsers(currentUser?.id)
              }}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              title="Alle anderen Logins zurücksetzen"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Logins zurücksetzen
            </button>
            <button
              onClick={() => addEmployee()}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Mitarbeiter
            </button>
          </div>
        }
        padded={false}
      >
        {roster.employees.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Noch keine Mitarbeiter angelegt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">Vorname</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="w-40 px-3 py-2 text-left">Team</th>
                  <th className="w-32 px-3 py-2 text-left">Kürzel</th>
                  <th className="w-36 px-3 py-2 text-left">Personalnr.</th>
                  <th className="w-40 px-3 py-2 text-left">Rolle</th>
                  <th className="w-40 px-3 py-2 text-left">Passwort</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {roster.employees.map((e) => (
                  <EmployeeRow
                    key={e.id}
                    emp={e}
                    teams={roster.teams}
                    roles={roles}
                    isMe={e.id === currentUser?.id}
                    pwRevealed={revealedPw.has(e.id)}
                    onTogglePw={() => toggleRevealPw(e.id)}
                    onUpdate={(patch) => updateEmployee(e.id, patch)}
                    onRemove={() => {
                      const label = `${e.vorname} ${e.name}`.trim() || 'Unbenannt'
                      if (confirm(`Mitarbeiter "${label}" löschen?`)) removeEmployee(e.id)
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

function EmployeeRow({
  emp,
  teams,
  roles,
  isMe,
  pwRevealed,
  onTogglePw,
  onUpdate,
  onRemove,
}: {
  emp: RosterEmployee
  teams: RosterTeam[]
  roles: Role[]
  isMe: boolean
  pwRevealed: boolean
  onTogglePw: () => void
  onUpdate: (patch: Partial<Omit<RosterEmployee, 'id'>>) => void
  onRemove: () => void
}) {
  const team = teams.find((t) => t.id === emp.teamId)
  const teamMissing = !!emp.teamId && !team
  const roleMissing = !!emp.roleId && !roles.some((r) => r.id === emp.roleId)
  return (
    <tr className="group border-b last:border-b-0">
      <td className="px-3 py-2">
        <input
          value={emp.vorname}
          onChange={(e) => onUpdate({ vorname: e.target.value })}
          placeholder="Vorname"
          className="w-full rounded bg-foreground/[0.03] px-2 py-1 text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
        />
        {isMe && (
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Du
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          value={emp.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Name"
          className="w-full rounded bg-foreground/[0.03] px-2 py-1 text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={emp.teamId ?? ''}
          onChange={(e) => onUpdate({ teamId: e.target.value || undefined })}
          className={cn(
            'w-full rounded bg-foreground/[0.03] px-2 py-1 text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]',
            teamMissing && 'text-destructive',
          )}
        >
          <option value="">— ohne Team —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || 'Unbenannt'}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          value={emp.kuerzel ?? ''}
          onChange={(e) => onUpdate({ kuerzel: e.target.value || undefined })}
          placeholder="MuA"
          className="w-full rounded bg-foreground/[0.03] px-2 py-1 font-mono text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={emp.personalnummer ?? ''}
          onChange={(e) => onUpdate({ personalnummer: e.target.value || undefined })}
          placeholder="P-0014"
          className="w-full rounded bg-foreground/[0.03] px-2 py-1 font-mono text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={emp.roleId ?? ''}
          onChange={(e) => onUpdate({ roleId: e.target.value || undefined })}
          className={cn(
            'w-full rounded bg-foreground/[0.03] px-2 py-1 text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]',
            roleMissing && 'text-destructive',
          )}
        >
          <option value="">— keine —</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name || 'Unbenannt'}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            type={pwRevealed ? 'text' : 'password'}
            value={emp.password ?? ''}
            onChange={(e) => onUpdate({ password: e.target.value || undefined })}
            placeholder="•••••••"
            className="w-full rounded bg-foreground/[0.03] px-2 py-1 font-mono text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]"
          />
          <button
            onClick={onTogglePw}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title={pwRevealed ? 'Verbergen' : 'Anzeigen'}
          >
            {pwRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={onRemove}
          disabled={isMe}
          className={cn(
            'rounded p-1 transition-opacity',
            isMe
              ? 'cursor-not-allowed text-muted-foreground/40'
              : 'text-muted-foreground/40 opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100',
          )}
          title={isMe ? 'Du kannst dich nicht selbst löschen' : 'Löschen'}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}
