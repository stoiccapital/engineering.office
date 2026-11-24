import { documentRoutes } from '../../../server/routes'

// Rechnungsplan per month (YYYY-MM).
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: (p) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(p.key) ? `rechnungsplan-${p.key}` : null),
  maxBytes: 2_000_000,
})
