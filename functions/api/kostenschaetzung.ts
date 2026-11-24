import { documentRoutes } from '../../server/routes'

// Kostenschätzung (Bauwerke, HOAI, Katalog).
export const { onRequestGet, onRequestPut } = documentRoutes({
  key: () => 'kostenschaetzung',
  maxBytes: 2_000_000,
})
