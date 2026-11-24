import { documentRoutes } from '../../server/routes'

// Kostenermittlung projects.
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: () => 'kostenermittlung',
  maxBytes: 2_000_000,
})
