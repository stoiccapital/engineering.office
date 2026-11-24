import { documentRoutes } from '../../../server/routes'

// Ziele per year.
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: (p) => (/^\d{4}$/.test(p.year) ? `ziele-${p.year}` : null),
  maxBytes: 500_000,
})
