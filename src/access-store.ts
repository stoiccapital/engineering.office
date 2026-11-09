import { create } from 'zustand'
import {
  clearRoleCredentials,
  clearUserCredentials,
  fetchAccess,
  fetchPublicRoles,
  fetchPublicUsers,
  saveAccess,
  setRoleCredentials,
  setUserCredentials,
  signInRole,
  signInUser,
  type PublicRole,
  type PublicUser,
} from './api'
import {
  displayUserName,
  emptyAccessConfig,
  type AccessConfig,
  type ModuleId,
  type Role,
  type User,
} from './types'

const CURRENT_ROLE_KEY = 'eo:currentRoleId'
const CURRENT_USER_KEY = 'eo:currentUserId'

type Status = 'idle' | 'loading' | 'ready' | 'saving' | 'error'

// Minimal session identity. currentRole carries the modules; currentUser (if
// signed in via user login) carries the display name.
export type SessionRole = { id: string; name: string; modules: ModuleId[] }
export type SessionUser = { id: string; kuerzel: string; displayName: string }

type State = {
  publicRoles: PublicRole[]
  publicUsers: PublicUser[]
  config: AccessConfig
  currentRole: SessionRole | null
  currentUser: SessionUser | null
  status: Status
  error: string | null
  load: () => Promise<void>
  loadFullConfig: () => Promise<void>
  signInAsRole: (roleId: string, password: string) => Promise<boolean>
  signInAsUser: (kuerzel: string, password: string) => Promise<boolean>
  signOut: () => void
  addRole: (name: string, password: string, modules: ModuleId[]) => Promise<Role>
  updateRole: (id: string, patch: Partial<Omit<Role, 'id'>>) => void
  removeRole: (id: string) => void
  addUser: (data: Omit<User, 'id'>) => Promise<User>
  updateUser: (id: string, patch: Partial<Omit<User, 'id'>>) => void
  removeUser: (id: string) => void
  // Wipe every entry in AccessConfig.users except the one matching exceptId
  // (keeps the currently signed-in legacy admin functional, if any).
  clearLegacyUsers: (exceptId?: string) => void
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function readLS(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(key)
}

function hydrate(raw: AccessConfig | null): AccessConfig {
  if (!raw) return emptyAccessConfig()
  return { roles: raw.roles ?? [], users: raw.users ?? [] }
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

  async function refreshPublic() {
    try {
      const [roles, users] = await Promise.all([fetchPublicRoles(), fetchPublicUsers()])
      set({ publicRoles: roles, publicUsers: users })
    } catch {
      // ignore
    }
  }

  async function maybeLoadFullConfig(modules: ModuleId[]) {
    if (!modules.includes('settings')) return
    try {
      const raw = await fetchAccess()
      set({ config: hydrate(raw) })
    } catch {
      // ignore
    }
  }

  return {
    publicRoles: [],
    publicUsers: [],
    config: emptyAccessConfig(),
    currentRole: null,
    currentUser: null,
    status: 'idle',
    error: null,

    load: async () => {
      set({ status: 'loading', error: null })
      try {
        const [roles, users] = await Promise.all([fetchPublicRoles(), fetchPublicUsers()])
        set({ publicRoles: roles, publicUsers: users, status: 'ready' })

        // Resume user session first (primary path).
        const userId = readLS(CURRENT_USER_KEY)
        if (userId) {
          const pubUser = users.find((u) => u.id === userId)
          const pw = localStorage.getItem('eo:currentUserPassword') ?? ''
          if (pubUser && pw) {
            const res = await signInUser(pubUser.kuerzel, pw)
            if (res) {
              set({
                currentRole: { id: res.role.id, name: res.role.name, modules: res.role.modules as ModuleId[] },
                currentUser: res.user ?? { id: pubUser.id, kuerzel: pubUser.kuerzel, displayName: pubUser.displayName },
              })
              await maybeLoadFullConfig(res.role.modules as ModuleId[])
              return
            }
          }
          clearUserCredentials()
          localStorage.removeItem(CURRENT_USER_KEY)
        }

        // Legacy role-only resume (bootstrap before any users exist).
        const roleId = readLS(CURRENT_ROLE_KEY)
        if (!roleId) return
        const match = roles.find((r) => r.id === roleId)
        if (!match) {
          clearRoleCredentials()
          localStorage.removeItem(CURRENT_ROLE_KEY)
          return
        }
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
        clearRoleCredentials()
        localStorage.removeItem(CURRENT_ROLE_KEY)
      } catch (e) {
        set({ status: 'error', error: (e as Error).message })
      }
    },

    loadFullConfig: async () => {
      const raw = await fetchAccess()
      set({ config: hydrate(raw) })
    },

    signInAsRole: async (roleId, password) => {
      try {
        const res = await signInRole(roleId, password)
        if (!res) return false
        setRoleCredentials(roleId, password)
        localStorage.setItem(CURRENT_ROLE_KEY, roleId)
        set({
          currentRole: { id: res.role.id, name: res.role.name, modules: res.role.modules as ModuleId[] },
          currentUser: null,
        })
        await maybeLoadFullConfig(res.role.modules as ModuleId[])
        return true
      } catch {
        return false
      }
    },

    signInAsUser: async (kuerzel, password) => {
      try {
        const res = await signInUser(kuerzel, password)
        if (!res || !res.user) return false
        setUserCredentials(kuerzel, password)
        localStorage.setItem(CURRENT_USER_KEY, res.user.id)
        // Drop any legacy role login so headers() picks the user header.
        clearRoleCredentials()
        localStorage.removeItem(CURRENT_ROLE_KEY)
        set({
          currentRole: { id: res.role.id, name: res.role.name, modules: res.role.modules as ModuleId[] },
          currentUser: res.user,
        })
        await maybeLoadFullConfig(res.role.modules as ModuleId[])
        return true
      } catch {
        return false
      }
    },

    signOut: () => {
      clearUserCredentials()
      clearRoleCredentials()
      localStorage.removeItem(CURRENT_USER_KEY)
      localStorage.removeItem(CURRENT_ROLE_KEY)
      set({ currentRole: null, currentUser: null, config: emptyAccessConfig() })
    },

    addRole: async (name, password, modules) => {
      const role: Role = { id: newId('r'), name: name.trim(), password, modules }
      set((s) => ({ config: { ...s.config, roles: [...s.config.roles, role] } }))
      await persist()
      await refreshPublic()
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
        if (patch.password && !get().currentUser) setRoleCredentials(id, patch.password)
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
      set((s) => ({
        config: {
          ...s.config,
          roles: s.config.roles.filter((r) => r.id !== id),
          // Orphaned users keep their roleId; admin should reassign or remove them.
        },
      }))
      if (get().currentRole?.id === id) {
        clearRoleCredentials()
        clearUserCredentials()
        localStorage.removeItem(CURRENT_ROLE_KEY)
        localStorage.removeItem(CURRENT_USER_KEY)
        set({ currentRole: null, currentUser: null })
      }
      void persist()
    },

    addUser: async (data) => {
      const user: User = { id: newId('u'), ...data, kuerzel: data.kuerzel.trim() }
      set((s) => ({ config: { ...s.config, users: [...s.config.users, user] } }))
      await persist()
      await refreshPublic()
      return user
    },

    updateUser: (id, patch) => {
      set((s) => ({
        config: {
          ...s.config,
          users: s.config.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        },
      }))
      void persist()
      const cur = get().currentUser
      if (cur && cur.id === id) {
        const updated = get().config.users.find((u) => u.id === id)
        if (updated) {
          if (patch.password) setUserCredentials(updated.kuerzel, patch.password)
          else if (patch.kuerzel) {
            const pw = localStorage.getItem('eo:currentUserPassword') ?? ''
            if (pw) setUserCredentials(updated.kuerzel, pw)
          }
          set({
            currentUser: {
              id: updated.id,
              kuerzel: updated.kuerzel,
              displayName: displayUserName(updated),
            },
          })
        }
      }
      void refreshPublic()
    },

    removeUser: (id) => {
      set((s) => ({
        config: {
          ...s.config,
          users: s.config.users.filter((u) => u.id !== id),
        },
      }))
      if (get().currentUser?.id === id) {
        clearUserCredentials()
        localStorage.removeItem(CURRENT_USER_KEY)
        set({ currentUser: null, currentRole: null })
      }
      void persist()
      void refreshPublic()
    },

    clearLegacyUsers: (exceptId) => {
      set((s) => ({
        config: {
          ...s.config,
          users: exceptId ? s.config.users.filter((u) => u.id === exceptId) : [],
        },
      }))
      void persist()
      void refreshPublic()
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
