import { create } from 'zustand'
import { fetchKostenschaetzung, saveKostenschaetzung } from '@/api'
import { emptyProject, normalize } from '@/features/kostenschaetzung/lib/domain'
import seed from '@/features/kostenschaetzung/data/seedProject.json'
import type {
  Bauwerk,
  Kostenschaetzung,
  LineItem,
  Section,
} from '@/features/kostenschaetzung/types'

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

type State = {
  doc: Kostenschaetzung | null
  activeBauwerkId: string | null
  status: Status
  error: string | null
  load: () => Promise<void>
  setProjectName: (name: string) => void
  setActiveBauwerk: (id: string) => void
  addBauwerk: (name: string) => string
  renameBauwerk: (id: string, name: string, km?: string) => void
  removeBauwerk: (id: string) => void
  duplicateBauwerk: (id: string) => void
  addSection: (bauwerkId: string, name: string, lfdNr?: number) => string
  renameSection: (bauwerkId: string, id: string, name: string) => void
  removeSection: (bauwerkId: string, id: string) => void
  addItem: (bauwerkId: string, sectionId: string, item?: Partial<LineItem>) => string
  updateItem: (
    bauwerkId: string,
    sectionId: string,
    id: string,
    patch: Partial<LineItem>,
  ) => void
  removeItem: (bauwerkId: string, sectionId: string, id: string) => void
  resetToSeed: () => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(
  get: () => State,
  set: (p: Partial<State>) => void,
) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.doc) return
    try {
      await saveKostenschaetzung({ ...s.doc, updatedAt: new Date().toISOString() })
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

function mutate(
  get: () => State,
  set: (p: Partial<State>) => void,
  fn: (doc: Kostenschaetzung) => Kostenschaetzung,
) {
  const s = get()
  if (!s.doc) return
  const next = fn(s.doc)
  set({ doc: next })
  scheduleSave(get, set)
}

function updateBauwerk(
  doc: Kostenschaetzung,
  bauwerkId: string,
  fn: (b: Bauwerk) => Bauwerk,
): Kostenschaetzung {
  return {
    ...doc,
    bauwerke: doc.bauwerke.map((b) => (b.id === bauwerkId ? fn(b) : b)),
  }
}

function updateSection(
  b: Bauwerk,
  sectionId: string,
  fn: (sec: Section) => Section,
): Bauwerk {
  return {
    ...b,
    sections: b.sections.map((s) => (s.id === sectionId ? fn(s) : s)),
  }
}

export const useKostenschaetzung = create<State>()((set, get) => ({
  doc: null,
  activeBauwerkId: null,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const raw = await fetchKostenschaetzung()
      const doc = raw ? normalize(raw) : normalize(seed as unknown)
      const first = doc.bauwerke[0]?.id ?? null
      set({ doc, activeBauwerkId: first, status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  setProjectName: (name) => mutate(get, set, (d) => ({ ...d, projectName: name })),

  setActiveBauwerk: (id) => set({ activeBauwerkId: id }),

  addBauwerk: (name) => {
    const id = genId()
    mutate(get, set, (d) => ({
      ...d,
      bauwerke: [...d.bauwerke, { id, name, sections: [] }],
    }))
    set({ activeBauwerkId: id })
    return id
  },

  renameBauwerk: (id, name, km) =>
    mutate(get, set, (d) =>
      updateBauwerk(d, id, (b) => ({ ...b, name, km: km ?? b.km })),
    ),

  removeBauwerk: (id) => {
    const s = get()
    mutate(get, set, (d) => ({
      ...d,
      bauwerke: d.bauwerke.filter((b) => b.id !== id),
    }))
    if (s.activeBauwerkId === id) {
      const remaining = get().doc?.bauwerke[0]?.id ?? null
      set({ activeBauwerkId: remaining })
    }
  },

  duplicateBauwerk: (id) => {
    let newId = ''
    mutate(get, set, (d) => {
      const src = d.bauwerke.find((b) => b.id === id)
      if (!src) return d
      newId = genId()
      const clone: Bauwerk = {
        ...src,
        id: newId,
        name: `${src.name} (Kopie)`,
        sections: src.sections.map((sec) => ({
          ...sec,
          id: genId(),
          items: sec.items.map((it) => ({ ...it, id: genId() })),
        })),
      }
      return { ...d, bauwerke: [...d.bauwerke, clone] }
    })
    if (newId) set({ activeBauwerkId: newId })
  },

  addSection: (bauwerkId, name, lfdNr) => {
    const id = genId()
    mutate(get, set, (d) =>
      updateBauwerk(d, bauwerkId, (b) => {
        const nextNr =
          lfdNr ?? (b.sections.length ? Math.max(...b.sections.map((x) => x.lfdNr)) + 1 : 1)
        return { ...b, sections: [...b.sections, { id, lfdNr: nextNr, name, items: [] }] }
      }),
    )
    return id
  },

  renameSection: (bauwerkId, id, name) =>
    mutate(get, set, (d) =>
      updateBauwerk(d, bauwerkId, (b) => updateSection(b, id, (sec) => ({ ...sec, name }))),
    ),

  removeSection: (bauwerkId, id) =>
    mutate(get, set, (d) =>
      updateBauwerk(d, bauwerkId, (b) => ({
        ...b,
        sections: b.sections.filter((sec) => sec.id !== id),
      })),
    ),

  addItem: (bauwerkId, sectionId, item) => {
    const id = genId()
    const newItem: LineItem = {
      id,
      kgk: item?.kgk ?? null,
      text: item?.text ?? 'Neue Position',
      faktor: item?.faktor ?? 1,
      menge: item?.menge ?? 0,
      einheit: item?.einheit ?? '',
      einheitspreis: item?.einheitspreis ?? 0,
      anmerkung: item?.anmerkung ?? null,
      erlaeuterung: item?.erlaeuterung ?? null,
    }
    mutate(get, set, (d) =>
      updateBauwerk(d, bauwerkId, (b) =>
        updateSection(b, sectionId, (sec) => ({ ...sec, items: [...sec.items, newItem] })),
      ),
    )
    return id
  },

  updateItem: (bauwerkId, sectionId, id, patch) =>
    mutate(get, set, (d) =>
      updateBauwerk(d, bauwerkId, (b) =>
        updateSection(b, sectionId, (sec) => ({
          ...sec,
          items: sec.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        })),
      ),
    ),

  removeItem: (bauwerkId, sectionId, id) =>
    mutate(get, set, (d) =>
      updateBauwerk(d, bauwerkId, (b) =>
        updateSection(b, sectionId, (sec) => ({
          ...sec,
          items: sec.items.filter((it) => it.id !== id),
        })),
      ),
    ),

  resetToSeed: () => {
    const doc = normalize(seed as unknown)
    const first = doc.bauwerke[0]?.id ?? null
    set({ doc, activeBauwerkId: first })
    scheduleSave(get, set)
  },
}))

export function emptyDoc(): Kostenschaetzung {
  return emptyProject()
}
