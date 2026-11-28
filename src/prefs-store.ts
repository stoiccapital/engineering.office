import { create } from 'zustand'
import { fetchUserPrefs, saveUserPrefs } from '@/api'
import { createAutosave } from './lib/autosave'

// Per-user preferences: theme (dark/light) + accent color. Server-persisted
// via `functions/api/user-prefs.ts` (shared `documents` table, keyed per
// userId). localStorage holds a fallback for the first paint so there's
// no flash of indigo before the server responds; the server value is the
// source of truth once hydrated.

export type Theme = 'light' | 'dark'
export type Accent = 'indigo' | 'blue' | 'teal' | 'amber' | 'rose' | 'violet'

export const ACCENT_OPTIONS: Accent[] = [
  'indigo',
  'blue',
  'teal',
  'amber',
  'rose',
  'violet',
]

type PrefsDoc = {
  theme: Theme
  accent: Accent
  updatedAt?: string
}

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type State = {
  theme: Theme
  accent: Accent
  status: Status
  hydrated: boolean
  error: string | null
  load: () => Promise<void>
  setTheme: (t: Theme) => void
  setAccent: (a: Accent) => void
}

const THEME_KEY = 'eo:theme'
const ACCENT_KEY = 'eo:accent'

function readTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readAccent(): Accent {
  const stored = localStorage.getItem(ACCENT_KEY)
  if (stored && (ACCENT_OPTIONS as string[]).includes(stored)) return stored as Accent
  return 'indigo'
}

export const usePrefs = create<State>()((set, get) => {
  const autosave = createAutosave<PrefsDoc>({
    save: (doc, mode) => saveUserPrefs(doc, { keepalive: mode === 'keepalive' }),
    onStatus: (status, error) => set({ status, error }),
  })
  function scheduleSave() {
    const s = get()
    autosave.schedule({
      theme: s.theme,
      accent: s.accent,
      updatedAt: new Date().toISOString(),
    })
  }
  return {
  theme: readTheme(),
  accent: readAccent(),
  status: 'idle',
  hydrated: false,
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const raw = (await fetchUserPrefs()) as PrefsDoc | null
      if (raw && typeof raw === 'object') {
        const nextTheme: Theme =
          raw.theme === 'dark' || raw.theme === 'light' ? raw.theme : get().theme
        const nextAccent: Accent =
          raw.accent && (ACCENT_OPTIONS as string[]).includes(raw.accent as string)
            ? (raw.accent as Accent)
            : get().accent
        set({ theme: nextTheme, accent: nextAccent, hydrated: true, status: 'saved' })
        // Mirror into localStorage so the next cold boot repaints with the
        // right values immediately instead of flashing indigo.
        localStorage.setItem(THEME_KEY, nextTheme)
        localStorage.setItem(ACCENT_KEY, nextAccent)
      } else {
        // First-time user — no server doc yet. Keep current values, persist
        // them so subsequent devices inherit.
        set({ hydrated: true, status: 'saved' })
        scheduleSave()
      }
    } catch (e) {
      // Not signed in / offline — keep localStorage values, flag hydrated so
      // the UI stops waiting but note the error.
      set({ hydrated: true, status: 'error', error: (e as Error).message })
    }
  },

  setTheme: (t) => {
    if (get().theme === t) return
    set({ theme: t })
    localStorage.setItem(THEME_KEY, t)
    if (get().hydrated) scheduleSave()
  },

  setAccent: (a) => {
    if (get().accent === a) return
    set({ accent: a })
    localStorage.setItem(ACCENT_KEY, a)
    if (get().hydrated) scheduleSave()
  },
  }
})
