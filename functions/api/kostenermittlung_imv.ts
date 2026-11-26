import { documentRoutes } from '../../server/routes'

// Kostenermittlung IMV workspace — singleton blob matching the IMV HTML app's
// `state` shape: { schema, active, estimates[], settings, customCatalogs }.
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: () => 'kostenermittlung_imv',
  maxBytes: 10_000_000,
})
