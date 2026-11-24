import { documentRoutes } from '../../server/routes'

// Kostenermittlung catalog overrides.
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: () => 'katalogOverrides',
  maxBytes: 4_000_000,
})
