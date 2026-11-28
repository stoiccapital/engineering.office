/**
 * Shared autosave helper. Fixes two historic bugs in one place:
 *
 * 1. Silent data loss — a debounce timer dies with the tab. Here we flush
 *    every pending payload on `beforeunload`, `pagehide`, and
 *    `visibilitychange=hidden` using fetch{keepalive:true} so the request
 *    outlives the page.
 *
 * 2. Lying save indicator — "Gespeichert" shown while a follow-up edit was
 *    already debounced. Here the helper owns status transitions and only
 *    emits `saved` when nothing is scheduled, nothing is in flight, and the
 *    last save succeeded. See docs/principles.md §"Autosave status must be
 *    honest".
 *
 * Usage:
 *   const autosave = createAutosave<PlanPayload>({
 *     save: (p, mode) =>
 *       savePlan(p.year, p.plan, { keepalive: mode === 'keepalive' }),
 *     onStatus: (status, error) => set({ status, error }),
 *   })
 *   autosave.schedule(payload)  // every edit
 *   await autosave.flush()       // before swapping documents
 */

export type SaveMode = 'normal' | 'keepalive'
export type SaveStatus = 'saving' | 'saved' | 'error'

type PanicFlush = () => void
const pending = new Set<PanicFlush>()

if (typeof window !== 'undefined') {
  const flushAll = () => {
    for (const fn of pending) {
      try { fn() } catch { /* nothing we can do here */ }
    }
  }
  window.addEventListener('beforeunload', flushAll)
  window.addEventListener('pagehide', flushAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
}

export interface Autosave<T> {
  /** Replace any pending payload and (re)start the debounce. Also emits 'saving'. */
  schedule(payload: T): void
  /** Await any in-flight save, then fire any still-pending payload immediately. */
  flush(): Promise<void>
  /** True when either a timer is armed, a payload is queued, or a save is in flight. */
  isDirty(): boolean
  /** Drop subscription to lifecycle events. */
  dispose(): void
}

export function createAutosave<T>(opts: {
  save: (payload: T, mode: SaveMode) => Promise<void> | void
  /** Debounce in ms. Default 500. */
  delay?: number
  /** Called whenever the helper's save state transitions. */
  onStatus?: (status: SaveStatus, error: string | null) => void
}): Autosave<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latest: T | null = null
  let running: Promise<void> | null = null
  const delay = opts.delay ?? 500

  const emit = (s: SaveStatus, e: string | null = null) => opts.onStatus?.(s, e)
  const isDirty = () => latest !== null || timer !== null || running !== null

  const runNormal = async (): Promise<void> => {
    if (timer) { clearTimeout(timer); timer = null }
    if (!latest) return
    const payload = latest
    latest = null
    running = Promise.resolve(opts.save(payload, 'normal'))
    try {
      await running
      // "Gespeichert" is only truthful when there's no new work waiting.
      // If `latest` or `timer` got set during the await, the next cycle
      // emits 'saved' — stay on 'saving' until then.
      if (!isDirty()) emit('saved', null)
    } catch (e) {
      emit('error', (e as Error).message)
    } finally {
      running = null
      // If a schedule arrived during the save, the follow-up timer is
      // already set and will fire runNormal again. Nothing to do here.
    }
  }

  const panicFlush: PanicFlush = () => {
    if (!latest) return
    const payload = latest
    latest = null
    if (timer) { clearTimeout(timer); timer = null }
    try { void opts.save(payload, 'keepalive') } catch { /* page is dying */ }
  }

  const self: Autosave<T> = {
    schedule(payload) {
      latest = payload
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void runNormal() }, delay)
      emit('saving', null)
    },
    async flush() {
      if (running) await running
      if (latest) await runNormal()
    },
    isDirty,
    dispose() {
      pending.delete(panicFlush)
      if (timer) { clearTimeout(timer); timer = null }
      latest = null
    },
  }
  pending.add(panicFlush)
  return self
}
