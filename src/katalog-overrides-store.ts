import { create } from 'zustand'
import { fetchKatalogOverrides, saveKatalogOverrides } from '@/api'
import { logActivity } from '@/activity-store'

function log(action: string, target?: string) {
  logActivity({ kind: 'action', module: 'ke_datenbank', action, target })
}
import type { FreiEntry, KgkEntry } from '@/features/kostenermittlung/lib/katalog'
import {
  emptyOverrides,
  normalizeOverrides,
  type FreiPatch,
  type KatalogOverrides,
  type KgkPatch,
} from '@/features/kostenermittlung/lib/katalogOverrides'

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  overrides: KatalogOverrides | null
  status: Status
  error: string | null
  load: () => Promise<void>
  updateKgk: (code: string, patch: KgkPatch) => void
  addKgk: (entry: KgkEntry) => void
  removeKgk: (code: string) => void
  hideKgk: (code: string) => void
  showKgk: (code: string) => void
  updateFrei: (id: number, patch: FreiPatch) => void
  addFrei: (entry: FreiEntry) => void
  removeFrei: (id: number) => void
  hideFrei: (id: number) => void
  showFrei: (id: number) => void
  reset: () => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.overrides) return
    try {
      await saveKatalogOverrides({ ...s.overrides, updatedAt: new Date().toISOString() })
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

function mutate(
  get: () => State,
  set: (p: Partial<State>) => void,
  fn: (o: KatalogOverrides) => KatalogOverrides,
) {
  const s = get()
  if (!s.overrides) return
  const next = fn(s.overrides)
  set({ overrides: next })
  scheduleSave(get, set)
}

export const useKatalogOverrides = create<State>()((set, get) => ({
  overrides: null,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const raw = await fetchKatalogOverrides()
      const overrides = raw ? normalizeOverrides(raw) : emptyOverrides()
      set({ overrides, status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  updateKgk: (code, patch) => {
    mutate(get, set, (o) => ({
      ...o,
      kgkUpdates: { ...o.kgkUpdates, [code]: { ...o.kgkUpdates[code], ...patch } },
    }))
    log(`kgk.update.${Object.keys(patch).join(',') || 'any'}`, code)
  },

  addKgk: (entry) => {
    mutate(get, set, (o) => ({ ...o, kgkAdded: [...o.kgkAdded, entry] }))
    log('kgk.add', entry.code)
  },

  removeKgk: (code) => {
    mutate(get, set, (o) => {
      if (o.kgkAdded.some((e) => e.code === code)) {
        return { ...o, kgkAdded: o.kgkAdded.filter((e) => e.code !== code) }
      }
      if (o.kgkHidden.includes(code)) return o
      return { ...o, kgkHidden: [...o.kgkHidden, code] }
    })
    log('kgk.remove', code)
  },

  hideKgk: (code) => {
    mutate(get, set, (o) =>
      o.kgkHidden.includes(code) ? o : { ...o, kgkHidden: [...o.kgkHidden, code] },
    )
    log('kgk.hide', code)
  },

  showKgk: (code) => {
    mutate(get, set, (o) => ({
      ...o,
      kgkHidden: o.kgkHidden.filter((c) => c !== code),
    }))
    log('kgk.show', code)
  },

  updateFrei: (id, patch) => {
    mutate(get, set, (o) => ({
      ...o,
      freiUpdates: {
        ...o.freiUpdates,
        [String(id)]: { ...o.freiUpdates[String(id)], ...patch },
      },
    }))
    log(`frei.update.${Object.keys(patch).join(',') || 'any'}`, String(id))
  },

  addFrei: (entry) => {
    mutate(get, set, (o) => ({ ...o, freiAdded: [...o.freiAdded, entry] }))
    log('frei.add', entry.bezeichnung)
  },

  removeFrei: (id) => {
    mutate(get, set, (o) => {
      if (o.freiAdded.some((e) => e.id === id)) {
        return { ...o, freiAdded: o.freiAdded.filter((e) => e.id !== id) }
      }
      if (o.freiHidden.includes(id)) return o
      return { ...o, freiHidden: [...o.freiHidden, id] }
    })
    log('frei.remove', String(id))
  },

  hideFrei: (id) => {
    mutate(get, set, (o) =>
      o.freiHidden.includes(id) ? o : { ...o, freiHidden: [...o.freiHidden, id] },
    )
    log('frei.hide', String(id))
  },

  showFrei: (id) => {
    mutate(get, set, (o) => ({
      ...o,
      freiHidden: o.freiHidden.filter((x) => x !== id),
    }))
    log('frei.show', String(id))
  },

  reset: () => {
    set({ overrides: emptyOverrides() })
    log('overrides.reset')
    scheduleSave(get, set)
  },
}))
