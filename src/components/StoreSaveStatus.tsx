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

type Selector = (s: { status: SaveStatusValue; error: string | null }) => { status: SaveStatusValue; error: string | null }
const pickStatusError: Selector = (s) => ({ status: s.status, error: s.error })

/** Registry of store → hook that exposes `status` and `error`. */
const STORES: Record<StoreKey, () => { status: SaveStatusValue; error: string | null }> = {
  forecast: () => useForecast(pickStatusError as never),
  plan: () => usePlan(pickStatusError as never),
  ziele: () => useZiele(pickStatusError as never),
  umsatz: () => useUmsatz(pickStatusError as never),
  rechnungen: () => useRechnungen(pickStatusError as never),
  hr: () => useHr(pickStatusError as never),
  projektliste: () => useProjektliste(pickStatusError as never),
  imv: () => useImv(pickStatusError as never),
}

export function StoreSaveStatus({ store }: { store: StoreKey }) {
  const { status, error } = STORES[store]()
  return <SaveIndicator status={status} error={error} />
}
