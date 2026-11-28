/**
 * One SaveStatus to rule them all. Replaces PlanSaveStatus, SaveStatus
 * (forecast), ZieleSaveStatus, UmsatzSaveStatus, RechnungenSaveStatus,
 * HrSaveStatus, ProjektlisteSaveStatus, KostenermittlungImvSaveStatus —
 * each of which was a 7-line wrapper reading {status, error} from a store
 * and rendering <SaveIndicator>.
 *
 * Pass the store name; the component wires up the correct zustand hook via
 * a tiny registry. Tree-shakeable because every registered hook is already
 * imported elsewhere in the app.
 */
import { useForecast } from '@/store'
import { useHr } from '@/hr-store'
import { useImv } from '@/imv-store'
import { usePlan } from '@/plan-store'
import { useProjektliste } from '@/projektliste-store'
import { useRechnungen } from '@/rechnungen-store'
import { useUmsatz } from '@/umsatz-store'
import { useZiele } from '@/ziele-store'
import { SaveIndicator } from '@/components/ui/save-indicator'

type SaveStatusValue = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type StoreKey =
  | 'forecast'
  | 'plan'
  | 'ziele'
  | 'umsatz'
  | 'rechnungen'
  | 'hr'
  | 'projektliste'
  | 'imv'

// IMPORTANT: each selector must return a PRIMITIVE (status string or error
// string|null). Returning an object { status, error } creates a new reference
// on every call and zustand's default Object.is check fires an infinite
// re-render loop ("Maximum update depth exceeded"). See docs/principles.md
// §1 and the Zustand selector rule in CLAUDE memory.
const STORES: Record<StoreKey, { useStatus: () => SaveStatusValue; useError: () => string | null }> = {
  forecast: {
    useStatus: () => useForecast((s) => s.status as SaveStatusValue),
    useError: () => useForecast((s) => s.error),
  },
  plan: {
    useStatus: () => usePlan((s) => s.status as SaveStatusValue),
    useError: () => usePlan((s) => s.error),
  },
  ziele: {
    useStatus: () => useZiele((s) => s.status as SaveStatusValue),
    useError: () => useZiele((s) => s.error),
  },
  umsatz: {
    useStatus: () => useUmsatz((s) => s.status as SaveStatusValue),
    useError: () => useUmsatz((s) => s.error),
  },
  rechnungen: {
    useStatus: () => useRechnungen((s) => s.status as SaveStatusValue),
    useError: () => useRechnungen((s) => s.error),
  },
  hr: {
    useStatus: () => useHr((s) => s.status as SaveStatusValue),
    useError: () => useHr((s) => s.error),
  },
  projektliste: {
    useStatus: () => useProjektliste((s) => s.status as SaveStatusValue),
    useError: () => useProjektliste((s) => s.error),
  },
  imv: {
    useStatus: () => useImv((s) => s.status as SaveStatusValue),
    useError: () => useImv((s) => s.error),
  },
}

export function StoreSaveStatus({ store }: { store: StoreKey }) {
  const entry = STORES[store]
  const status = entry.useStatus()
  const error = entry.useError()
  return <SaveIndicator status={status} error={error} />
}
