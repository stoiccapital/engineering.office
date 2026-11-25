import { documentRoutes } from '../../server/routes'

// Kostenermittlung workspace — one blob holding multiple projects.
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: () => 'kostenermittlung',
  maxBytes: 10_000_000,
})
