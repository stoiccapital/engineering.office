import { create } from 'zustand'
import { fetchLogo, saveLogo, deleteLogo } from './api'

type Status = 'idle' | 'loading' | 'ready' | 'uploading' | 'error'

type State = {
  dataUrl: string | null
  status: Status
  error: string | null
  load: () => Promise<void>
  upload: (dataUrl: string) => Promise<void>
  remove: () => Promise<void>
}

export const useLogo = create<State>()((set) => ({
  dataUrl: null,
  status: 'idle',
  error: null,
  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const dataUrl = await fetchLogo()
      set({ dataUrl, status: 'ready' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },
  upload: async (dataUrl) => {
    set({ status: 'uploading', error: null })
    try {
      await saveLogo(dataUrl)
      set({ dataUrl, status: 'ready' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },
  remove: async () => {
    set({ status: 'uploading', error: null })
    try {
      await deleteLogo()
      set({ dataUrl: null, status: 'ready' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },
}))
