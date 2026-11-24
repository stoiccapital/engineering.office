import { documentRoutes } from '../../../server/routes'

// Forecast period (YYYY-Qn). Stored under the bare key, as in KV.
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: (p) => (/^\d{4}-Q[1-4]$/.test(p.key) ? p.key : null),
  maxBytes: 2_000_000,
})
