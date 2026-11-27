import { create } from 'zustand'
import { fetchHr, saveHr } from '@/api'
import { createAutosave } from './lib/autosave'
import { logActivity } from '@/activity-store'

function log(action: string, target?: string) {
  // All HR mutations roll up under hr_zeiterfassung for the activity log.
  // Gespräche-specific actions use the action name to disambiguate.
  logActivity({ kind: 'action', module: 'hr_zeiterfassung', action, target })
}
import {
  buildUtterance,
  emptyDoc,
  normalize,
  todayISO,
} from '@/features/hr/lib/domain'
import seed from '@/features/hr/data/seed.json'
import type { HrDoc, ZeitEntry } from '@/features/hr/types'

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

type State = {
  doc: HrDoc | null
  status: Status
  error: string | null
  load: () => Promise<void>
  addEntry: (init: Partial<ZeitEntry> & { employeeId: string }) => string
  updateEntry: (id: string, patch: Partial<ZeitEntry>) => void
  removeEntry: (id: string) => void
  duplicateEntry: (id: string) => void
  postUtterance: (employeeId: string, author: string, text: string) => void
  removeUtterance: (employeeId: string, utteranceId: string) => void
}


export const useHr = create<State>()((set, get) => {
  const autosave = createAutosave<HrDoc>({
    save: async (doc, mode) => {
      if (mode === 'keepalive') {
        await saveHr(doc, { keepalive: true })
        return
      }
      try {
        await saveHr(doc)
        set({ status: 'saved', error: null })
      } catch (e) {
        set({ status: 'error', error: (e as Error).message })
      }
    },
  })
  function scheduleSave() {
    const s = get()
    if (!s.doc) return
    set({ status: 'saving' })
    autosave.schedule({ ...s.doc, updatedAt: new Date().toISOString() })
  }
  function mutate(fn: (doc: HrDoc) => HrDoc) {
    const s = get()
    if (!s.doc) return
    set({ doc: fn(s.doc) })
    scheduleSave()
  }
  return {
  doc: null,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const raw = await fetchHr()
      const doc = raw ? normalize(raw) : normalize(seed as unknown)
      set({ doc, status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  addEntry: (init) => {
    const id = genId()
    const entry: ZeitEntry = {
      id,
      datum: init.datum ?? todayISO(),
      employeeId: init.employeeId,
      projektId: init.projektId ?? null,
      projekt: init.projekt ?? '',
      stunden: init.stunden ?? 0,
      pause: init.pause ?? 0,
      notiz: init.notiz ?? '',
    }
    mutate((d) => ({ ...d, entries: [...d.entries, entry] }))
    log('entry.add', `${entry.datum} · ${entry.employeeId}`)
    return id
  },

  updateEntry: (id, patch) => {
    mutate((d) => ({
      ...d,
      entries: d.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }))
    log(`entry.update.${Object.keys(patch).join(',') || 'any'}`, id)
  },

  removeEntry: (id) => {
    mutate((d) => ({
      ...d,
      entries: d.entries.filter((e) => e.id !== id),
    }))
    log('entry.remove', id)
  },

  duplicateEntry: (id) => {
    mutate((d) => {
      const src = d.entries.find((e) => e.id === id)
      if (!src) return d
      const i = d.entries.findIndex((e) => e.id === id)
      const clone: ZeitEntry = { ...src, id: genId() }
      const next = [...d.entries]
      next.splice(i + 1, 0, clone)
      return { ...d, entries: next }
    })
    log('entry.duplicate', id)
  },

  postUtterance: (employeeId, author, text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const u = buildUtterance(author, trimmed)
    mutate((d) => {
      const i = d.threads.findIndex((t) => t.employeeId === employeeId)
      if (i === -1) {
        return {
          ...d,
          threads: [...d.threads, { employeeId, utterances: [u] }],
        }
      }
      const next = [...d.threads]
      next[i] = { ...next[i], utterances: [...next[i].utterances, u] }
      return { ...d, threads: next }
    })
    log('gespraeche.post', `→ ${employeeId}`)
  },

  removeUtterance: (employeeId, utteranceId) => {
    mutate((d) => ({
      ...d,
      threads: d.threads.map((t) =>
        t.employeeId === employeeId
          ? { ...t, utterances: t.utterances.filter((u) => u.id !== utteranceId) }
          : t,
      ),
    }))
    log('gespraeche.remove', `${employeeId} · ${utteranceId}`)
  },
  }
})

export function emptyHrDoc(): HrDoc {
  return emptyDoc()
}
