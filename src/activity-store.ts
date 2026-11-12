import { create } from 'zustand'
import { fetchActivity, logActivity as apiLogActivity } from '@/api'
import type { ActivityEvent } from '@/types'
import { useAccess } from '@/access-store'

type SaveStatus = 'idle' | 'loading' | 'saved' | 'error'

type State = {
  days: number
  events: ActivityEvent[]
  status: SaveStatus
  error: string | null
  setDays: (n: number) => void
  load: () => Promise<void>
}

export const useActivity = create<State>()((set, get) => ({
  days: 7,
  events: [],
  status: 'idle',
  error: null,
  setDays: (n) => {
    set({ days: n })
    void get().load()
  },
  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const events = await fetchActivity(get().days)
      set({ events, status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },
}))

// Fire-and-forget activity logger. Pulls the current user from access-store so
// callers don't have to pass it explicitly.
export function logActivity(
  input: Omit<ActivityEvent, 'ts' | 'user'> & { user?: string },
): void {
  const user = input.user ?? currentUserLabel()
  if (!user) return
  void apiLogActivity({ ...input, user })
}

function currentUserLabel(): string | null {
  const state = useAccess.getState()
  const u = state.currentUser
  if (u?.kuerzel) return u.kuerzel
  const r = state.currentRole
  return r?.name ?? null
}
