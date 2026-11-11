import type { Bauwerk, Kostenschaetzung, LineItem, Section } from '../types'

export function itemSum(it: LineItem): number {
  return (it.faktor ?? 1) * it.menge * it.einheitspreis
}

export function sectionSum(section: Section): number {
  return section.items.reduce((a, it) => a + itemSum(it), 0)
}

export function bauwerkSum(b: Bauwerk): number {
  return b.sections.reduce((a, sec) => a + sectionSum(sec), 0)
}

export function projectSum(p: Kostenschaetzung): number {
  return p.bauwerke.reduce((a, b) => a + bauwerkSum(b), 0)
}

export function emptyProject(): Kostenschaetzung {
  return {
    projectName: 'Kostenschätzung',
    bauwerke: [],
    umsatzsteuer: 0.19,
  }
}

export function normalize(doc: unknown): Kostenschaetzung {
  const genId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  const src = (doc ?? {}) as Partial<Kostenschaetzung> & { id?: string }
  return {
    projectName: src.projectName ?? 'Kostenschätzung',
    umsatzsteuer: src.umsatzsteuer ?? 0.19,
    bauwerke: (src.bauwerke ?? []).map((b) => ({
      id: b.id ?? genId(),
      name: b.name,
      km: b.km,
      sections: (b.sections ?? []).map((s) => ({
        id: s.id ?? genId(),
        lfdNr: s.lfdNr,
        name: s.name,
        items: (s.items ?? []).map((it) => ({
          id: it.id ?? genId(),
          kgk: it.kgk ?? null,
          text: it.text ?? '',
          faktor: it.faktor ?? 1,
          menge: it.menge ?? 0,
          einheit: it.einheit ?? '',
          einheitspreis: it.einheitspreis ?? 0,
          anmerkung: it.anmerkung ?? null,
          erlaeuterung: it.erlaeuterung ?? null,
        })),
      })),
    })),
  }
}
