export type LineItem = {
  id: string
  kgk?: string | null
  text: string
  faktor: number
  menge: number
  einheit: string
  einheitspreis: number
  anmerkung?: string | null
  erlaeuterung?: string | null
}

export type Section = {
  id: string
  lfdNr: number
  name: string
  items: LineItem[]
}

export type Bauwerk = {
  id: string
  name: string
  km?: string
  sections: Section[]
}

export type Kostenschaetzung = {
  projectName: string
  bauwerke: Bauwerk[]
  umsatzsteuer: number
  updatedAt?: string
}

export type KatalogEntry = {
  id: string
  kgkCode: string | null
  kgkPath: string | null
  kgkBezeichnung: string | null
  bezeichnung: string | null
  erlaeuterung: string | null
  ansatzGrundlage: string | null
  einheit: string | null
  preisart: string | null
  preis: number | null
  quelle: string | null
  fundstelle: string | null
  pruefhinweis: string | null
}

export type KatalogMeta = {
  quartal: string
  quelle: string
  count: number
  roots: { name: string; count: number }[]
}
