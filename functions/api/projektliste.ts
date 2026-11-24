import { documentRoutes } from '../../server/routes'

// Projektliste (shared controlling view).
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: () => 'projektliste',
  maxBytes: 10_000_000,
})
