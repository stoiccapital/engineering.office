import { documentRoutes } from '../../server/routes'

// HR (Zeiterfassung, Gespräche).
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: () => 'hr',
  maxBytes: 2_000_000,
})
