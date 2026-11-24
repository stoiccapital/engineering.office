import { documentRoutes } from '../../../server/routes'

// Umsatzkontrolle per year.
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: (p) => (/^\d{4}$/.test(p.year) ? `umsatz-${p.year}` : null),
  maxBytes: 500_000,
})
