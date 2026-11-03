import { create } from 'zustand'
import {
  fetchAccess,
  fetchPublicRoles,
  saveAccess,
  setRoleCredentials,
  clearRoleCredentials,
  signInRole,
  type PublicRole,
} from './api'
import {
  emptyAccessConfig,
  type AccessConfig,
  type ModuleId,
  type Role,
} from './types'

const CURRENT_ROLE_KEY = 'eo:currentRoleId'

type Status = 'idle' | 'loading' | 'ready' | 'saving' | 'error'

// Minimal role identity carried for the signed-in session.
export type SessionRole = { id: string; name: string; modules: ModuleId[] }

type State = {
  publicRoles: PublicRole[]
  config: AccessConfig // full config (populated only when admin is signed in)
  currentRole: SessionRole | null
  status: Status
  error: string | null
  load: () => Promise<void>
  loadFullConfig: () => Promise<void>
  signIn: (roleId: string, password: string) => Promise<boolean>
  signOut: () => void
  addRole: (name: string, password: string, modules: ModuleId[]) => Promise<Role>
  updateRole: (id: string, patch: Partial<Omit<Role, 'id'>>) => void
  removeRole: (id: string) => void
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function readCurrentRoleId(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(CURRENT_ROLE_KEY)
}

function hydrate(raw: AccessConfig | null): AccessConfig {
  if (!raw) return emptyAccessConfig()
  return { roles: raw.roles ?? [] }
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
    }
  }

  return {
    publicRoles: [],
    config: emptyAccessConfig(),
    currentRole: null,
    status: 'idle',
    error: null,

    load: async () => {
      set({ status: 'loading', error: null })
      try {
        const roles = await fetchPublicRoles()
        set({ publicRoles: roles, status: 'ready' })

        const roleId = readCurrentRoleId()
        if (!roleId) return

        const match = roles.find((r) => r.id === roleId)
        if (!match) {
          clearRoleCredentials()
          localStorage.removeItem(CURRENT_ROLE_KEY)
          return
        }

        // Try to pull the full config — succeeds for admins, fails silently otherwise.
        try {
          const raw = await fetchAccess()
          const cfg = hydrate(raw)
          set({ config: cfg })
          const role = cfg.roles.find((r) => r.id === roleId)
          if (role) {
            set({
              currentRole: { id: role.id, name: role.name, modules: role.modules },
            })
            return
          }
        } catch {
          // Non-admin: can't read /api/settings/access.
        }

        // Non-admin resume: we only have id+name from publicRoles, and we have the
        // password in localStorage. Hit signin to recover modules.
        const pw = localStorage.getItem('eo:currentRolePassword') ?? ''
        if (pw) {
          const res = await signInRole(roleId, pw)
          if (res) {
            set({
              currentRole: { id: res.role.id, name: res.role.name, modules: res.role.modules as ModuleId[] },
            })
            return
          }
        }

        // Password missing or no longer valid → force re-login.
        clearRoleCredentials()
        localStorage.removeItem(CURRENT_ROLE_KEY)
      } catch (e) {
        set({ status: 'error', error: (e as Error).message })
      }
    },

    loadFullConfig: async () => {
      const raw = await fetchAccess()
      const cfg = hydrate(raw)
      set({ config: cfg })
    },

    signIn: async (roleId, password) => {
      try {
        const res = await signInRole(roleId, password)
        if (!res) return false
        setRoleCredentials(roleId, password)
        localStorage.setItem(CURRENT_ROLE_KEY, roleId)
        set({
          currentRole: { id: res.role.id, name: res.role.name, modules: res.role.modules as ModuleId[] },
        })
        if (res.role.modules.includes('settings')) {
          try {
            await get().loadFullConfig()
          } catch {
            // ignore
          }
        }
        return true
      } catch {
        return false
      }
    },

    signOut: () => {
      clearRoleCredentials()
      localStorage.removeItem(CURRENT_ROLE_KEY)
      set({ currentRole: null, config: emptyAccessConfig() })
    },

    addRole: async (name, password, modules) => {
      const role: Role = { id: newId(), name: name.trim(), password, modules }
      set((s) => ({ config: { roles: [...s.config.roles, role] } }))
      await persist()
      try {
        const roles = await fetchPublicRoles()
        set({ publicRoles: roles })
      } catch {
        // ignore
      }
      return role
    },

    updateRole: (id, patch) => {
      set((s) => ({
        config: {
          roles: s.config.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        },
      }))
      void persist()
      const cur = get().currentRole
      if (cur && cur.id === id) {
        if (patch.password) setRoleCredentials(id, patch.password)
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
      set((s) => ({ config: { roles: s.config.roles.filter((r) => r.id !== id) } }))
      if (get().currentRole?.id === id) {
        clearRoleCredentials()
        localStorage.removeItem(CURRENT_ROLE_KEY)
        set({ currentRole: null })
      }
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
