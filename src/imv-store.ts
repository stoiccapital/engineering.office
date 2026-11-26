import { create } from 'zustand'
import { fetchKostenermittlungImv, saveKostenermittlungImv } from '@/api'
import { logActivity } from '@/activity-store'

// The IMV HTML app owns its own state schema (schema / estimates[] / settings /
// customCatalogs). We persist it as an opaque JSON blob — mutations happen
// inside the iframe and arrive here via postMessage. The parent only loads,
// hydrates, and debounce-saves.

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  doc: unknown | null
  // 'hydrated' once we've read from the server — the iframe can now safely
  // hydrate itself. On fresh workspaces the server returns null; we still
  // flip to 'hydrated' so the iframe knows to boot its demo state.
  hydrated: boolean
  status: Status
  error: string | null
  load: () => Promise<void>
  // Called by KeImvFrame when the iframe posts an imv:persist message with
  // its current full state. Updates doc + schedules a debounced server save.
  receiveFromFrame: (state: unknown) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (s.doc === null) return
    try {
      await saveKostenermittlungImv(s.doc)
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

export const useImv = create<State>()((set, get) => ({
  doc: null,
  hydrated: false,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const raw = await fetchKostenermittlungImv()
      // Server may return null on first load (no doc yet) — that's fine, the
      // iframe will boot its own demo state and the first mutation persists.
      set({ doc: raw ?? null, hydrated: true, status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message, hydrated: true })
    }
  },

  receiveFromFrame: (state) => {
    set({ doc: state })
    scheduleSave(get, set)
    logActivity({ kind: 'action', module: 'ke_imv_projekte', action: 'persist' })
  },
}))
