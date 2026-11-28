/**
 * Undo queue. One pending undo at a time; a fresh push replaces the
 * previous one (user already moved on). See docs/principles.md §4
 * ("Undo beats confirm"): any reversible destructive action should push
 * an entry here instead of triggering a confirmation dialog.
 */
import { create } from 'zustand'

export interface UndoEntry {
  id: number
  label: string
  onUndo: () => void
}

interface UndoState {
  current: UndoEntry | null
  push: (label: string, onUndo: () => void) => void
  undo: () => void
  dismiss: () => void
}

let nextId = 1

export const useUndo = create<UndoState>()((set, get) => ({
  current: null,
  push: (label, onUndo) => set({ current: { id: nextId++, label, onUndo } }),
  undo: () => {
    const cur = get().current
    if (!cur) return
    cur.onUndo()
    set({ current: null })
  },
  dismiss: () => set({ current: null }),
}))
