import { create } from 'zustand'
import { auth, fetchAccess, fetchMe, saveAccess, type SessionUser as ApiSessionUser } from './api'
import { emptyAccessConfig, migrateModuleIds, MODULES, type AccessConfig, type ModuleId, type Role } from './types'

type Status = 'idle' | 'loading' | 'ready' | 'saving' | 'error'

// Session identity. currentRole carries the modules; currentUser the person.
export type SessionRole = { id: string; name: string; modules: ModuleId[] }
export type SessionUser = { id: string; kuerzel: string; displayName: string; email: string; employeeId: string | null }

type State = {
  config: AccessConfig
  // The user's actual role — never overwritten by "view as". Used to check
  // admin privileges before entering view-as mode.
  realRole: SessionRole | null
  // The role the UI should respect for nav/module gating. Equal to realRole
  // except while an admin is impersonating via "view as".
  currentRole: SessionRole | null
  // When an admin is impersonating another role for testing, this is the id
  // of the role being viewed. null = viewing as the real role.
  viewAsRoleId: string | null
  currentUser: SessionUser | null
  // Signed in, but no role assigned yet (waiting for an admin).
  awaitingRole: SessionUser | null
  status: Status
  error: string | null
  load: () => Promise<void>
  loadFullConfig: () => Promise<void>
  // Apply a session returned by login / verify / reset / claim.
  setSession: (user: ApiSessionUser | null) => Promise<void>
  signOut: () => Promise<void>
  // Admin-only: impersonate another role for the current session. Pass null
  // to return to the real role.
  setViewAsRole: (roleId: string | null) => void
  addRole: (name: string, modules: ModuleId[]) => Promise<Role>
  updateRole: (id: string, patch: Partial<Omit<Role, 'id'>>) => void
  removeRole: (id: string) => void
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function hydrate(raw: AccessConfig | null): AccessConfig {
  if (!raw) return emptyAccessConfig()
  // Expand legacy coarse module IDs (ziele, umsatz, kostenschaetzung) to
  // their fine-grained equivalents so existing stored roles keep working.
  const roles = (raw.roles ?? []).map((r) => ({ ...r, password: '', modules: migrateModuleIds(r.modules ?? []) }))
  return { roles, users: [] }
}

function toSessionUser(u: ApiSessionUser): SessionUser {
  return {
    id: u.id,
    // Label used in the activity log and elsewhere: Kürzel if linked to a
    // Mitarbeiter, otherwise the email address.
    kuerzel: u.kuerzel || u.email,
    displayName: u.displayName || u.email,
    email: u.email,
    employeeId: u.employeeId,
  }
}

export const useAccess = create<State>()((set, get) => {
  async function persist() {
    const cfg = get().config
    set({ status: 'saving', error: null })
    try {
      await saveAccess(cfg)
      set({ status: 'ready' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
      // Server rejected the change (e.g. removing the last admin): reload truth.
      try {
        set({ config: hydrate(await fetchAccess()) })
      } catch {
        // ignore
      }
    }
  }

  async function applyUser(user: ApiSessionUser | null) {
    if (!user) {
      set({
        currentUser: null,
        currentRole: null,
        realRole: null,
        viewAsRoleId: null,
        awaitingRole: null,
        config: emptyAccessConfig(),
      })
      return
    }
    const su = toSessionUser(user)
    if (!user.role) {
      set({ currentUser: null, currentRole: null, realRole: null, viewAsRoleId: null, awaitingRole: su })
      return
    }
    const modules = migrateModuleIds(user.role.modules)
    const role: SessionRole = { id: user.role.id, name: user.role.name, modules }
    set({
      currentUser: su,
      awaitingRole: null,
      realRole: role,
      currentRole: role,
      viewAsRoleId: null,
    })
    if (modules.includes('settings')) {
      try {
        set({ config: hydrate(await fetchAccess()) })
      } catch {
        // ignore
      }
    }
  }

  return {
    config: emptyAccessConfig(),
    realRole: null,
    currentRole: null,
    viewAsRoleId: null,
    currentUser: null,
    awaitingRole: null,
    status: 'idle',
    error: null,

    load: async () => {
      set({ status: 'loading', error: null })
      try {
        await applyUser(await fetchMe())
        set({ status: 'ready' })
      } catch (e) {
        set({ status: 'error', error: (e as Error).message })
      }
    },

    loadFullConfig: async () => {
      set({ config: hydrate(await fetchAccess()) })
    },

    setSession: async (user) => {
      await applyUser(user)
      set({ status: 'ready' })
    },

    signOut: async () => {
      try {
        await auth.logout()
      } catch {
        // ignore — local state is cleared regardless
      }
      set({
        currentRole: null,
        realRole: null,
        viewAsRoleId: null,
        currentUser: null,
        awaitingRole: null,
        config: emptyAccessConfig(),
      })
    },

    setViewAsRole: (roleId) => {
      const s = get()
      // Only an admin (by their real role) may enter view-as mode.
      if (!s.realRole || !s.realRole.modules.includes('settings')) return
      if (roleId === null) {
        set({ viewAsRoleId: null, currentRole: s.realRole })
        return
      }
      const found = s.config.roles.find((r) => r.id === roleId)
      if (!found) return
      const modules = migrateModuleIds(found.modules)
      set({
        viewAsRoleId: roleId,
        currentRole: { id: found.id, name: found.name, modules },
      })
    },

    addRole: async (name, modules) => {
      const role: Role = { id: newId('r'), name: name.trim(), password: '', modules }
      set((s) => ({ config: { ...s.config, roles: [...s.config.roles, role] } }))
      await persist()
      return role
    },

    updateRole: (id, patch) => {
      set((s) => ({
        config: {
          ...s.config,
          roles: s.config.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        },
      }))
      void persist()
      const s = get()
      const nextName = (cur: SessionRole) => patch.name ?? cur.name
      const nextModules = (cur: SessionRole) =>
        (patch.modules as ModuleId[] | undefined) ?? cur.modules
      if (s.realRole && s.realRole.id === id) {
        const updated: SessionRole = {
          ...s.realRole,
          name: nextName(s.realRole),
          modules: nextModules(s.realRole),
        }
        set({ realRole: updated })
        // Mirror into currentRole if not impersonating.
        if (!s.viewAsRoleId) set({ currentRole: updated })
      }
      if (s.viewAsRoleId && s.viewAsRoleId === id && s.currentRole) {
        set({
          currentRole: {
            ...s.currentRole,
            name: nextName(s.currentRole),
            modules: nextModules(s.currentRole),
          },
        })
      }
    },

    removeRole: (id) => {
      set((s) => ({ config: { ...s.config, roles: s.config.roles.filter((r) => r.id !== id) } }))
      void persist()
      const s = get()
      // If the admin was impersonating the just-removed role, snap back.
      if (s.viewAsRoleId === id && s.realRole) {
        set({ viewAsRoleId: null, currentRole: s.realRole })
      }
    },
  }
})

export function isAdmin(role: SessionRole | null): boolean {
  return role?.modules.includes('settings') ?? false
}

export function allowedModules(role: SessionRole | null): Set<ModuleId> {
  if (!role) return new Set()
  // Admins (any role granting the 'settings' module) implicitly get access
  // to every module in the system, so new modules are visible to admins
  // without needing to remember to add them to the admin role.
  if (role.modules.includes('settings')) return new Set(MODULES)
  return new Set(role.modules)
}
