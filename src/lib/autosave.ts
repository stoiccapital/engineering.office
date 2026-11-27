/**
 * Shared autosave helper for every zustand store that persists via a
 * debounced PUT. Fixes the "I typed and switched tabs — my edit is gone"
 * silent data loss: when the page is about to die (beforeunload, pagehide)
 * or go into the background on mobile (visibilitychange=hidden), we
 * synchronously flush every pending save using fetch{keepalive:true} so the
 * request outlives the page.
 *
 * Usage:
 *   const autosave = createAutosave<PlanPayload>({
 *     save: async (p, mode) => {
 *       // mode === 'keepalive' when called from beforeunload/pagehide.
 *       // Only signal UI status on the normal path — the page is already
 *       // gone when keepalive fires.
 *       if (mode === 'keepalive') return savePlan(p.year, p.plan, { keepalive: true })
 *       try {
 *         await savePlan(p.year, p.plan)
 *         set({ status: 'saved', error: null })
 *       } catch (e) {
 *         set({ status: 'error', error: (e as Error).message })
 *       }
 *     },
 *   })
 *   // on every edit:
 *   autosave.schedule(payload)
 *   // before swapping documents (e.g. year change):
 *   await autosave.flush()
 */

export type SaveMode = 'normal' | 'keepalive'

/** Lifecycle-triggered panic flush callback. Returns nothing: the page is going. */
type PanicFlush = () => void
const pending = new Set<PanicFlush>()

if (typeof window !== 'undefined') {
  const flushAll = () => {
    for (const fn of pending) {
      try { fn() } catch { /* nothing we can do here */ }
    }
  }
  // beforeunload: the user is navigating away or closing the tab.
  window.addEventListener('beforeunload', flushAll)
  // pagehide: covers back/forward cache and some iOS cases beforeunload misses.
  window.addEventListener('pagehide', flushAll)
  // visibilitychange=hidden: mobile Safari discards hidden tabs. Save first.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
}

export interface Autosave<T> {
  /** Replace any pending payload and (re)start the debounce. */
  schedule(payload: T): void
  /** Await any in-flight save, then fire any still-pending payload immediately. */
  flush(): Promise<void>
  /** Drop subscription to lifecycle events. Called from store teardown — not usually needed. */
  dispose(): void
}

export function createAutosave<T>(opts: {
  save: (payload: T, mode: SaveMode) => Promise<void> | void
  /** Debounce in ms. Default 500. */
  delay?: number
}): Autosave<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latest: T | null = null
  let running: Promise<void> | null = null
  const delay = opts.delay ?? 500

  const runNormal = async (): Promise<void> => {
    if (timer) { clearTimeout(timer); timer = null }
    if (!latest) return
    const payload = latest
    latest = null
    running = Promise.resolve(opts.save(payload, 'normal')).finally(() => { running = null })
    await running
  }

  const panicFlush: PanicFlush = () => {
    if (!latest) return
    const payload = latest
    latest = null
    if (timer) { clearTimeout(timer); timer = null }
    // Fire-and-forget. The page is dying; we cannot await.
    try { void opts.save(payload, 'keepalive') } catch { /* dying */ }
  }

  const self: Autosave<T> = {
    schedule(payload) {
      latest = payload
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void runNormal() }, delay)
    },
    async flush() {
      if (running) await running
      if (latest) await runNormal()
    },
    dispose() {
      pending.delete(panicFlush)
      if (timer) { clearTimeout(timer); timer = null }
      latest = null
    },
  }
  pending.add(panicFlush)
  return self
}
