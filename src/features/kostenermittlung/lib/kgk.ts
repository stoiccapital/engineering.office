// KGK (Kostengliederungs-Kennzahl) catalog — the 8 DIN-276 Hauptgruppen and
// the Ebene-2 codes taken verbatim from the Vorlage_Kostenermittlung_nach_Ril_808
// workbook ("Auswertung-Übersicht Projekt" sheet, rows 20..132).

export type Hauptgruppe = {
  code: string // 7 digits, ends with 000000
  nummer: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  name: string
}

export type Ebene2 = {
  code: string // 7 digits
  name: string
  hauptgruppe: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  // When true this is the "— direkt / Sammler" catch-all slot for positions
  // that only have a Hauptgruppen-code (xxxx000) and no finer classification.
  sammler: boolean
}

export const HAUPTGRUPPEN: Hauptgruppe[] = [
  { code: '1000000', nummer: 1, name: 'Grundstück' },
  { code: '2000000', nummer: 2, name: 'Herrichten und Erschließen' },
  { code: '3000000', nummer: 3, name: 'Bauwerk - Baukonstruktionen' },
  { code: '4000000', nummer: 4, name: 'Bauwerk - Technische Anlagen' },
  { code: '5000000', nummer: 5, name: 'Außenanlagen' },
  { code: '6000000', nummer: 6, name: 'Ausstattung und Kunstwerke' },
  { code: '7000000', nummer: 7, name: 'Baunebenkosten' },
  { code: '8000000', nummer: 8, name: 'Fahrzeuge und sonstiges' },
]

export const EBENE2: Ebene2[] = [
  { code: '1010000', hauptgruppe: 1, name: 'Grundstückswert', sammler: false },
  { code: '1020000', hauptgruppe: 1, name: 'Grundstücksnebenkosten', sammler: false },
  { code: '1030000', hauptgruppe: 1, name: 'Freimachen', sammler: false },
  { code: '1000000', hauptgruppe: 1, name: 'Grundstück – direkt / Sammler', sammler: true },

  { code: '2010000', hauptgruppe: 2, name: 'Herrichten', sammler: false },
  { code: '2020000', hauptgruppe: 2, name: 'Öffentliche Erschließung', sammler: false },
  { code: '2030000', hauptgruppe: 2, name: 'Nichtöffentliche Erschließung', sammler: false },
  { code: '2040000', hauptgruppe: 2, name: 'Ausgleichsabgaben', sammler: false },
  { code: '2050000', hauptgruppe: 2, name: 'Übergangsmaßnahmen', sammler: false },
  { code: '2090000', hauptgruppe: 2, name: 'sonstige Maßnahmen', sammler: false },
  { code: '2000000', hauptgruppe: 2, name: 'Herrichten und Erschließen – direkt / Sammler', sammler: true },

  { code: '3010000', hauptgruppe: 3, name: 'Hochbau gemäß DIN 276-1', sammler: false },
  { code: '3020000', hauptgruppe: 3, name: 'Eisenbahnspezifische Hochbauten', sammler: false },
  { code: '3030000', hauptgruppe: 3, name: 'Empfangsgebäude', sammler: false },
  { code: '3040000', hauptgruppe: 3, name: 'Gebäude des Schienenweges', sammler: false },
  { code: '3050000', hauptgruppe: 3, name: 'Personenverkehrsanlagen', sammler: false },
  { code: '3060000', hauptgruppe: 3, name: 'Überdachung', sammler: false },
  { code: '3070000', hauptgruppe: 3, name: 'Unter-/Überführung', sammler: false },
  { code: '3090000', hauptgruppe: 3, name: 'sonstige Maßnahmen', sammler: false },
  { code: '3100000', hauptgruppe: 3, name: 'Erdbauwerke', sammler: false },
  { code: '3110000', hauptgruppe: 3, name: 'Erdbauwerk', sammler: false },
  { code: '3190000', hauptgruppe: 3, name: 'sonstige Maßnahmen', sammler: false },
  { code: '3200000', hauptgruppe: 3, name: 'Oberbau', sammler: false },
  { code: '3210000', hauptgruppe: 3, name: 'Gleise und Weichen', sammler: false },
  { code: '3290000', hauptgruppe: 3, name: 'sonstige Maßnahmen', sammler: false },
  { code: '3300000', hauptgruppe: 3, name: 'Ingenieurbauwerke', sammler: false },
  { code: '3310000', hauptgruppe: 3, name: 'Talbrücken mit Pfeilerhöhen > 10 m', sammler: false },
  { code: '3320000', hauptgruppe: 3, name: 'Stahlbrücken', sammler: false },
  { code: '3330000', hauptgruppe: 3, name: 'Massivbrücken', sammler: false },
  { code: '3340000', hauptgruppe: 3, name: 'Verbundbrücken', sammler: false },
  { code: '3350000', hauptgruppe: 3, name: 'Straßenbrücken', sammler: false },
  { code: '3360000', hauptgruppe: 3, name: 'Eisenbahnkreuzungs-Maßnahmen', sammler: false },
  { code: '3390000', hauptgruppe: 3, name: 'sonstige Maßnahmen', sammler: false },
  { code: '3410000', hauptgruppe: 3, name: 'Tunnel', sammler: false },
  { code: '3490000', hauptgruppe: 3, name: 'sonstige Maßnahmen', sammler: false },
  { code: '3510000', hauptgruppe: 3, name: 'Sonstige Ingenieurbauwerke', sammler: false },
  { code: '3520000', hauptgruppe: 3, name: 'Schaltanlagenbauwerke', sammler: false },
  { code: '3530000', hauptgruppe: 3, name: 'Werkstätten', sammler: false },
  { code: '3590000', hauptgruppe: 3, name: 'sonstige Maßnahmen', sammler: false },
  { code: '3000000', hauptgruppe: 3, name: 'Bauwerk - Baukonstruktionen – direkt / Sammler', sammler: true },

  { code: '4010000', hauptgruppe: 4, name: 'Abwasser-, Wasser-, Gasanlagen', sammler: false },
  { code: '4020000', hauptgruppe: 4, name: 'Wärmeversorgungsanlagen', sammler: false },
  { code: '4030000', hauptgruppe: 4, name: 'Lufttechnische Anlagen', sammler: false },
  { code: '4040000', hauptgruppe: 4, name: 'Starkstromanlagen', sammler: false },
  { code: '4050000', hauptgruppe: 4, name: 'Fernmelde- und informationstechnische Anlagen', sammler: false },
  { code: '4060000', hauptgruppe: 4, name: 'Förderanlagen', sammler: false },
  { code: '4070000', hauptgruppe: 4, name: 'Nutzungsspezifische Anlagen', sammler: false },
  { code: '4080000', hauptgruppe: 4, name: 'Gebäudeautomation', sammler: false },
  { code: '4090000', hauptgruppe: 4, name: 'sonstige Maßnahmen', sammler: false },
  { code: '4100000', hauptgruppe: 4, name: 'Leit- und sicherungstechnische Anlagen (LST)', sammler: false },
  { code: '4110000', hauptgruppe: 4, name: 'Melde- / Steuereinrichtung', sammler: false },
  { code: '4120000', hauptgruppe: 4, name: 'Fahrstraßen', sammler: false },
  { code: '4130000', hauptgruppe: 4, name: 'Signale', sammler: false },
  { code: '4140000', hauptgruppe: 4, name: 'Weichen und Sperren', sammler: false },
  { code: '4150000', hauptgruppe: 4, name: 'Zugeinwirkungs- und beeinflussungseinrichtungen', sammler: false },
  { code: '4160000', hauptgruppe: 4, name: 'Stromversorgung', sammler: false },
  { code: '4170000', hauptgruppe: 4, name: 'BÜ Sicherung', sammler: false },
  { code: '4180000', hauptgruppe: 4, name: 'Betriebliche Gefahrenmeldeeinrichtung und Rangieranlagen', sammler: false },
  { code: '4190000', hauptgruppe: 4, name: 'sonstige Maßnahmen', sammler: false },
  { code: '4200000', hauptgruppe: 4, name: 'Bahnstrom', sammler: false },
  { code: '4210000', hauptgruppe: 4, name: 'Neubau Oberleitungsanlage', sammler: false },
  { code: '4230000', hauptgruppe: 4, name: 'Neubau Energieanlage Bahnstrom', sammler: false },
  { code: '4240000', hauptgruppe: 4, name: 'Neubau Energieanlage Unterwerk', sammler: false },
  { code: '4250000', hauptgruppe: 4, name: 'Oberleitungsanlage im Bestand', sammler: false },
  { code: '4260000', hauptgruppe: 4, name: 'Oberleitungsanlage sonstige Einrichtungen', sammler: false },
  { code: '4270000', hauptgruppe: 4, name: 'Energieanlage Bahnstrom im Bestand', sammler: false },
  { code: '4280000', hauptgruppe: 4, name: 'Gleichstrom-Bahn (GS-Bahn)', sammler: false },
  { code: '4290000', hauptgruppe: 4, name: 'sonstige Maßnahmen', sammler: false },
  { code: '4000000', hauptgruppe: 4, name: 'Bauwerk - Technische Anlagen – direkt / Sammler', sammler: true },

  { code: '5010000', hauptgruppe: 5, name: 'Geländeflächen', sammler: false },
  { code: '5020000', hauptgruppe: 5, name: 'Befestigte Flächen', sammler: false },
  { code: '5030000', hauptgruppe: 5, name: 'Baukonstruktionen', sammler: false },
  { code: '5040000', hauptgruppe: 5, name: 'Technische Anlagen', sammler: false },
  { code: '5050000', hauptgruppe: 5, name: 'Einbauten', sammler: false },
  { code: '5060000', hauptgruppe: 5, name: 'Wasserflächen', sammler: false },
  { code: '5070000', hauptgruppe: 5, name: 'Pflanz- und Saatflächen', sammler: false },
  { code: '5080000', hauptgruppe: 5, name: 'Förderanlagen', sammler: false },
  { code: '5090000', hauptgruppe: 5, name: 'sonstige Maßnahmen', sammler: false },
  { code: '5100000', hauptgruppe: 5, name: 'Kompensationsmaßnahmen', sammler: false },
  { code: '5000000', hauptgruppe: 5, name: 'Außenanlagen – direkt / Sammler', sammler: true },

  { code: '6010000', hauptgruppe: 6, name: 'Ausstattung', sammler: false },
  { code: '6020000', hauptgruppe: 6, name: 'Kunstwerke', sammler: false },
  { code: '6000000', hauptgruppe: 6, name: 'Ausstattung und Kunstwerke – direkt / Sammler', sammler: true },

  { code: '7010000', hauptgruppe: 7, name: 'Bauherrenaufgabe', sammler: false },
  { code: '7020000', hauptgruppe: 7, name: 'Vorbereitung der Objektplanung', sammler: false },
  { code: '7030000', hauptgruppe: 7, name: 'Architekten- und Ingenieurleistungen', sammler: false },
  { code: '7040000', hauptgruppe: 7, name: 'Gutachten und Beratung', sammler: false },
  { code: '7050000', hauptgruppe: 7, name: 'Kunst', sammler: false },
  { code: '7060000', hauptgruppe: 7, name: 'Finanzierung', sammler: false },
  { code: '7070000', hauptgruppe: 7, name: 'Allgemeine Baunebenkosten', sammler: false },
  { code: '7090000', hauptgruppe: 7, name: 'sonstige Baunebenkosten', sammler: false },
  { code: '7110000', hauptgruppe: 7, name: 'Projektmanagement', sammler: false },
  { code: '7120000', hauptgruppe: 7, name: 'Planung', sammler: false },
  { code: '7130000', hauptgruppe: 7, name: 'Bauüberwachung', sammler: false },
  { code: '7000000', hauptgruppe: 7, name: 'Baunebenkosten – direkt / Sammler', sammler: true },

  { code: '8010000', hauptgruppe: 8, name: 'Schienengebundene Fahrzeuge', sammler: false },
  { code: '8020000', hauptgruppe: 8, name: 'Nicht schienengebundene Fahrzeuge', sammler: false },
  { code: '8030000', hauptgruppe: 8, name: 'Wasserfahrzeuge', sammler: false },
  { code: '8080000', hauptgruppe: 8, name: 'sonstiges', sammler: false },
  { code: '8000000', hauptgruppe: 8, name: 'Fahrzeuge und sonstiges – direkt / Sammler', sammler: true },
]

const EBENE2_BY_CODE = new Map<string, Ebene2>(EBENE2.map((e) => [e.code, e]))

export function findEbene2(code: string | null | undefined): Ebene2 | null {
  if (!code) return null
  return EBENE2_BY_CODE.get(code) ?? null
}

export function findHauptgruppe(nummer: number): Hauptgruppe | null {
  return HAUPTGRUPPEN.find((h) => h.nummer === nummer) ?? null
}

// Validates a user-entered KGK against the Hauptgruppe a position sits under.
// The Excel highlights positions red when the code is missing or doesn't match
// — we mirror that with a reason string the UI can surface. Note: Ril 808
// Ebene-6 uses alphanumeric variants (e.g. 712117A..712117I), so the last
// character may be an uppercase letter.
export function validateKgk(
  kgk: string | null | undefined,
  hauptgruppe: number,
): { ok: true } | { ok: false; reason: string } {
  if (!kgk) return { ok: false, reason: 'KGK-Nummer fehlt' }
  if (!/^[1-8]\d{5}[0-9A-Z]$/.test(kgk)) {
    return { ok: false, reason: 'KGK muss 7-stellig sein' }
  }
  if (Number(kgk[0]) !== hauptgruppe) {
    return { ok: false, reason: `KGK muss mit ${hauptgruppe} beginnen` }
  }
  // Ebene-2 catalog is the Übersicht bucket; we don't force the code to be in
  // it since the user may pick a deeper (Ebene 3–6) code from the Datenbank.
  // The Ebene-2 lookup still drives the rollup (via findEbene2 fallback to
  // the Hauptgruppen "— direkt / Sammler" row).
  return { ok: true }
}
