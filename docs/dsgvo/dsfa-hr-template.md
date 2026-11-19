# Datenschutz-Folgenabschätzung (DSFA) · HR-Modul

Rechtsgrundlage: Art. 35 DSGVO i. V. m. § 67 BDSG

> Diese DSFA ist **vor Produktivnahme** des HR-Moduls abzuschließen.
> Das Modul verarbeitet Beschäftigtendaten, enthält Freitexte aus
> Mitarbeitergesprächen und protokolliert Modul-Zugriffe — damit ist
> nach Art. 35 Abs. 3 lit. b DSGVO eine systematische Überwachung
> Beschäftigter nicht ausgeschlossen. Die DSK-Positivliste führt dieses
> Verarbeitungsszenario explizit als DSFA-pflichtig.

## 1. Systematische Beschreibung

### Gegenstand

Erfassung von Arbeitszeiten und Dokumentation von Gesprächen zwischen
Mitarbeitenden und Führungskräften.

### Kategorien personenbezogener Daten

- Stammdaten (Kürzel, Name, Rolle)
- Arbeitszeiten (Datum, Projektzuordnung, Stunden, Notiz)
- Gesprächsinhalte als Freitext

### Betroffene Personen

Alle Beschäftigten des Verantwortlichen.

### Zweck

- Erfüllung § 16 Abs. 2 ArbZG
- Projekt- und Ressourcenplanung
- Nachvollziehbare Dokumentation von Mitarbeitergesprächen

### Technische Umsetzung

- React-SPA, Backend als Cloudflare Workers
- Datenhaltung in Cloudflare KV
- Modul-Zugriffskontrolle `hr_zeiterfassung`, `hr_gespraeche`, `hr_team_view`

## 2. Bewertung der Notwendigkeit und Verhältnismäßigkeit

- **Rechtsgrundlage:** § 26 Abs. 1 BDSG + ggf. Betriebsvereinbarung
- **Alternative geprüft:** Papierbasierte oder E-Mail-basierte Erfassung —
  höheres Verlustrisiko, keine Zugangskontrolle, keine automatisierte
  Löschung
- **Datenminimierung:** Zeiterfassung enthält keine Standort- oder
  Gerätedaten; Gespräche-Modul erfasst ausschließlich manuell eingegebene
  Freitexte
- **Betroffenenrechte:** [TBD] — Prozess für Auskunft und Löschung

## 3. Bewertung der Risiken für Rechte und Freiheiten

| Risiko | Eintrittswahrscheinlichkeit | Schwere | Score |
|--------|-----------------------------|---------|-------|
| Unberechtigter Zugriff auf Gespräche | mittel | hoch | **hoch** |
| Erfassung besonderer Kategorien (Art. 9) im Freitext | mittel | hoch | **hoch** |
| Verwendung zur Leistungskontrolle ohne Mitbestimmung | gering | hoch | mittel |
| Datenabfluss an Drittstaat | gering | hoch | mittel |
| Fehlerhafte Löschung / Langzeitarchiv | mittel | mittel | mittel |

## 4. Abhilfemaßnahmen

- Rollengranulares Zugriffskonzept (`hr_team_view` ausschließlich für
  verantwortliche Führungskräfte)
- [TBD] Beschränkung des Zugriffs auf eigene Team-Mitglieder
  (aktuell: `hr_team_view` sieht alle Mitarbeitenden)
- [TBD] Protokollierung des Zugriffs auf einzelne HR-Threads
- Hinweis an Beschäftigte, keine besonderen Kategorien zu erfassen
- Löschfristen gemäß `retention-policy.md`
- Betriebsvereinbarung zur Zweckbindung und Leistungskontrolle
- EU-US-Transfer durch DPF + SCC abgesichert

## 5. Konsultation des Datenschutzbeauftragten

- [TBD: Datum, Stellungnahme]

## 6. Konsultation des Betriebsrats

- [TBD: Datum, Betriebsvereinbarung]

## 7. Ergebnis

- [TBD] "Nach Umsetzung der oben genannten Abhilfemaßnahmen ist das
  Restrisiko akzeptabel — keine Konsultation der Aufsichtsbehörde
  erforderlich (Art. 36 DSGVO)."
