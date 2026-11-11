export const SECTION_TO_KG: Record<number, 100 | 300 | 400 | 500 | 700> = {
  1: 100,
  2: 300,
  3: 300,
  4: 300,
  5: 300,
  6: 300,
  7: 300,
  8: 500,
  9: 500,
  10: 500,
  11: 700,
}

export const KG_LABELS: Record<number, string> = {
  100: 'Grundstück',
  200: 'Herrichten und Erschließen',
  300: 'Bauwerk — Baukonstruktionen',
  400: 'Bauwerk — Technische Anlagen',
  500: 'Außenanlagen',
  600: 'Ausstattung und Kunstwerke',
  700: 'Baunebenkosten',
  800: 'Fahrzeuge und sonstiges',
}

export const KG_KEYS = [100, 200, 300, 400, 500, 600, 700, 800] as const
