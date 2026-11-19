import { create } from 'zustand'
import { fetchKostenermittlung, saveKostenermittlung } from '@/api'
import { emptyDoc, normalize } from '@/features/kostenermittlung/lib/domain'
import seed from '@/features/kostenermittlung/data/seed.json'
import { logActivity } from '@/activity-store'
import type {
  Kostenermittlung,
  Position,
  Projektkopf,
} from '@/features/kostenermittlung/types'

function log(action: string, target?: string) {
  logActivity({ kind: 'action', module: 'ke_positionen', action, target })
}

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

type State = {
  doc: Kostenermittlung | null
  status: Status
  error: string | null
  load: () => Promise<void>
  setKopf: (patch: Partial<Projektkopf>) => void
  addPosition: (hauptgruppe: Position['hauptgruppe'], init?: Partial<Position>) => string
  updatePosition: (id: string, patch: Partial<Position>) => void
  removePosition: (id: string) => void
  duplicatePosition: (id: string) => void
  // Reorder all positions in a single Hauptgruppe to match `orderedIds`.
  // Positions in other Hauptgruppen keep their relative order.
  reorderInHauptgruppe: (hauptgruppe: Position['hauptgruppe'], orderedIds: string[]) => void
  resetToEmpty: () => void
  resetToSeed: () => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.doc) return
    try {
      await saveKostenermittlung({ ...s.doc, updatedAt: new Date().toISOString() })
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

function mutate(
  get: () => State,
  set: (p: Partial<State>) => void,
  fn: (doc: Kostenermittlung) => Kostenermittlung,
) {
  const s = get()
  if (!s.doc) return
  const next = fn(s.doc)
  set({ doc: next })
  scheduleSave(get, set)
}

export const useKostenermittlung = create<State>()((set, get) => ({
  doc: null,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const raw = await fetchKostenermittlung()
      const doc = raw ? normalize(raw) : normalize(seed as unknown)
      set({ doc, status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  setKopf: (patch) => {
    mutate(get, set, (d) => ({ ...d, kopf: { ...d.kopf, ...patch } }))
    log(`kopf.update.${Object.keys(patch).join(',') || 'any'}`)
  },

  addPosition: (hauptgruppe, init) => {
    const id = genId()
    const pos: Position = {
      id,
      kgk: init?.kgk ?? null,
      hauptgruppe,
      text: init?.text ?? '',
      anmerkung: init?.anmerkung ?? null,
      menge: init?.menge ?? 0,
      einheit: init?.einheit ?? '',
      einheitspreis: init?.einheitspreis ?? 0,
      erlaeuterung: init?.erlaeuterung ?? null,
    }
    mutate(get, set, (d) => ({ ...d, positionen: [...d.positionen, pos] }))
    log('position.add', `HG ${hauptgruppe} · ${pos.kgk ?? '—'}`)
    return id
  },

  updatePosition: (id, patch) => {
    mutate(get, set, (d) => ({
      ...d,
      positionen: d.positionen.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
    log(`position.update.${Object.keys(patch).join(',') || 'any'}`, id)
  },

  removePosition: (id) => {
    mutate(get, set, (d) => ({
      ...d,
      positionen: d.positionen.filter((p) => p.id !== id),
    }))
    log('position.remove', id)
  },

  duplicatePosition: (id) => {
    mutate(get, set, (d) => {
      const src = d.positionen.find((p) => p.id === id)
      if (!src) return d
      const i = d.positionen.findIndex((p) => p.id === id)
      const clone: Position = { ...src, id: genId() }
      const next = [...d.positionen]
      next.splice(i + 1, 0, clone)
      return { ...d, positionen: next }
    })
    log('position.duplicate', id)
  },

  reorderInHauptgruppe: (hauptgruppe, orderedIds) => {
    mutate(get, set, (d) => {
      const byId = new Map(d.positionen.map((p) => [p.id, p]))
      let idx = 0
      const nextList: Position[] = d.positionen.map((p) => {
        if (p.hauptgruppe !== hauptgruppe) return p
        const nextId = orderedIds[idx++]
        return byId.get(nextId) ?? p
      })
      return { ...d, positionen: nextList }
    })
    log('position.reorder', `HG ${hauptgruppe}`)
  },

  resetToEmpty: () => {
    set({ doc: emptyDoc() })
    log('doc.reset.empty')
    scheduleSave(get, set)
  },

  resetToSeed: () => {
    set({ doc: normalize(seed as unknown) })
    log('doc.reset.seed')
    scheduleSave(get, set)
  },
}))
