import { create } from 'zustand'
import { fetchKostenermittlung, saveKostenermittlung } from '@/api'
import {
  emptyProject,
  emptyWorkspace,
  normalizeWorkspace,
} from '@/features/kostenermittlung/lib/domain'
import { logActivity } from '@/activity-store'
import type {
  Kostenermittlung,
  KostenermittlungWorkspace,
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
  workspace: KostenermittlungWorkspace | null
  // Convenience mirror of the currently-active project, so existing consumers
  // can keep reading `doc` without caring about the workspace shape.
  doc: Kostenermittlung | null
  status: Status
  error: string | null
  load: () => Promise<void>
  // Project-level actions
  addProject: (projektId: string) => void
  selectProject: (projektId: string | null) => void
  removeProject: (projektId: string) => void
  // Position/kopf actions operate on the active project
  setKopf: (patch: Partial<Projektkopf>) => void
  addPosition: (hauptgruppe: Position['hauptgruppe'], init?: Partial<Position>) => string
  updatePosition: (id: string, patch: Partial<Position>) => void
  removePosition: (id: string) => void
  duplicatePosition: (id: string) => void
  reorderInHauptgruppe: (hauptgruppe: Position['hauptgruppe'], orderedIds: string[]) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function activeProject(ws: KostenermittlungWorkspace | null): Kostenermittlung | null {
  if (!ws || !ws.activeProjektId) return null
  return ws.projects.find((p) => p.projektId === ws.activeProjektId) ?? null
}

function scheduleSave(get: () => State, set: (p: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ status: 'saving' })
  saveTimer = setTimeout(async () => {
    const s = get()
    if (!s.workspace) return
    try {
      await saveKostenermittlung({
        ...s.workspace,
        updatedAt: new Date().toISOString(),
      })
      set({ status: 'saved', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  }, 500)
}

function mutateWorkspace(
  get: () => State,
  set: (p: Partial<State>) => void,
  fn: (ws: KostenermittlungWorkspace) => KostenermittlungWorkspace,
) {
  const s = get()
  if (!s.workspace) return
  const nextWs = fn(s.workspace)
  set({ workspace: nextWs, doc: activeProject(nextWs) })
  scheduleSave(get, set)
}

function mutateActiveProject(
  get: () => State,
  set: (p: Partial<State>) => void,
  fn: (p: Kostenermittlung) => Kostenermittlung,
) {
  const s = get()
  if (!s.workspace || !s.workspace.activeProjektId) return
  const activeId = s.workspace.activeProjektId
  mutateWorkspace(get, set, (ws) => ({
    ...ws,
    projects: ws.projects.map((p) => (p.projektId === activeId ? fn(p) : p)),
  }))
}

export const useKostenermittlung = create<State>()((set, get) => ({
  workspace: null,
  doc: null,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const raw = await fetchKostenermittlung()
      const workspace = raw ? normalizeWorkspace(raw) : emptyWorkspace()
      set({ workspace, doc: activeProject(workspace), status: 'saved' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  addProject: (projektId) => {
    mutateWorkspace(get, set, (ws) => {
      if (ws.projects.some((p) => p.projektId === projektId)) {
        // Already exists — just activate it.
        return { ...ws, activeProjektId: projektId }
      }
      return {
        ...ws,
        projects: [...ws.projects, emptyProject(projektId)],
        activeProjektId: projektId,
      }
    })
    log('project.add', projektId)
  },

  selectProject: (projektId) => {
    mutateWorkspace(get, set, (ws) => ({ ...ws, activeProjektId: projektId }))
    log('project.select', projektId ?? '(none)')
  },

  removeProject: (projektId) => {
    mutateWorkspace(get, set, (ws) => {
      const projects = ws.projects.filter((p) => p.projektId !== projektId)
      const activeProjektId =
        ws.activeProjektId === projektId
          ? projects[0]?.projektId ?? null
          : ws.activeProjektId
      return { ...ws, projects, activeProjektId }
    })
    log('project.remove', projektId)
  },

  setKopf: (patch) => {
    mutateActiveProject(get, set, (p) => ({ ...p, kopf: { ...p.kopf, ...patch } }))
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
    mutateActiveProject(get, set, (p) => ({
      ...p,
      positionen: [...p.positionen, pos],
    }))
    log('position.add', `HG ${hauptgruppe} · ${pos.kgk ?? '—'}`)
    return id
  },

  updatePosition: (id, patch) => {
    mutateActiveProject(get, set, (p) => ({
      ...p,
      positionen: p.positionen.map((pos) =>
        pos.id === id ? { ...pos, ...patch } : pos,
      ),
    }))
    log(`position.update.${Object.keys(patch).join(',') || 'any'}`, id)
  },

  removePosition: (id) => {
    mutateActiveProject(get, set, (p) => ({
      ...p,
      positionen: p.positionen.filter((pos) => pos.id !== id),
    }))
    log('position.remove', id)
  },

  duplicatePosition: (id) => {
    mutateActiveProject(get, set, (p) => {
      const src = p.positionen.find((pos) => pos.id === id)
      if (!src) return p
      const i = p.positionen.findIndex((pos) => pos.id === id)
      const clone: Position = { ...src, id: genId() }
      const next = [...p.positionen]
      next.splice(i + 1, 0, clone)
      return { ...p, positionen: next }
    })
    log('position.duplicate', id)
  },

  reorderInHauptgruppe: (hauptgruppe, orderedIds) => {
    mutateActiveProject(get, set, (p) => {
      const byId = new Map(p.positionen.map((pos) => [pos.id, pos]))
      let idx = 0
      const nextList: Position[] = p.positionen.map((pos) => {
        if (pos.hauptgruppe !== hauptgruppe) return pos
        const nextId = orderedIds[idx++]
        return byId.get(nextId) ?? pos
      })
      return { ...p, positionen: nextList }
    })
    log('position.reorder', `HG ${hauptgruppe}`)
  },
}))
