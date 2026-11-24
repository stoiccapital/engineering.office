import { create } from 'zustand'
import { auth, fetchAccess, fetchMe, saveAccess, type SessionUser as ApiSessionUser } from './api'
import { emptyAccessConfig, migrateModuleIds, type AccessConfig, type ModuleId, type Role } from './types'

type Status = 'idle' | 'loading' | 'ready' | 'saving' | 'error'

// Session identity. currentRole carries the modules; currentUser the person.
export type SessionRole = { id: string; name: string; modules: ModuleId[] }
export type SessionUser = { id: string; kuerzel: string; displayName: string; email: string; employeeId: string | null }

type State = {
  config: AccessConfig
  currentRole: SessionRole | null
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
      set({ currentUser: null, currentRole: null, awaitingRole: null, config: emptyAccessConfig() })
      return
    }
    const su = toSessionUser(user)
    if (!user.role) {
      set({ currentUser: null, currentRole: null, awaitingRole: su })
      return
    }
    const modules = migrateModuleIds(user.role.modules)
    set({ currentUser: su, awaitingRole: null, currentRole: { id: user.role.id, name: user.role.name, modules } })
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
    currentRole: null,
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
      set({ currentRole: null, currentUser: null, awaitingRole: null, config: emptyAccessConfig() })
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
      const cur = get().currentRole
      if (cur && cur.id === id) {
        set({
          currentRole: {
            ...cur,
            name: patch.name ?? cur.name,
            modules: (patch.modules as ModuleId[] | undefined) ?? cur.modules,
          },
        })
      }
    },

    removeRole: (id) => {
      set((s) => ({ config: { ...s.config, roles: s.config.roles.filter((r) => r.id !== id) } }))
      void persist()
    },
  }
})

export function isAdmin(role: SessionRole | null): boolean {
  return role?.modules.includes('settings') ?? false
}

export function allowedModules(role: SessionRole | null): Set<ModuleId> {
  if (!role) return new Set()
  return new Set(role.modules)
}
