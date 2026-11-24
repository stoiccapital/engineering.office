import { documentRoutes } from '../../../server/routes'

// Quartalsplanung per year.
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: (p) => (/^\d{4}$/.test(p.year) ? `plan-${p.year}` : null),
  maxBytes: 500_000,
})
