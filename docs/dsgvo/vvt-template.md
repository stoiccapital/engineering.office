# Verzeichnis von Verarbeitungstätigkeiten (VVT) · Art. 30 DSGVO

Dieses Dokument wird vom Verantwortlichen geführt und ist der Aufsichtsbehörde
auf Anfrage zugänglich zu machen.

## Allgemeine Angaben

| Feld | Wert |
|------|------|
| Verantwortlicher | [TBD] |
| Vertreter des Verantwortlichen | [TBD] |
| Datenschutzbeauftragter | [TBD] |
| Datum / Version | [TBD] |

## Verarbeitungstätigkeiten

### 1. Benutzer-Authentifizierung und Zugriffssteuerung

- **Zweck:** Zugriff auf die Anwendung auf berechtigte Beschäftigte beschränken
- **Betroffene:** Beschäftigte
- **Kategorien:** Kürzel, Vor-/Nachname, Rollenzuordnung, Passwort-Hash
- **Empfänger:** Auftragsverarbeiter Cloudflare (Hosting, KV)
- **Drittlandübermittlung:** USA auf Basis DPF + SCC
- **Löschfrist:** mit Austritt des Beschäftigten, spätestens 90 Tage danach
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO, § 26 Abs. 1 BDSG
- **TOM-Referenz:** siehe `tom-template.md`

### 2. Zeiterfassung

- **Zweck:** Erfüllung § 16 Abs. 2 ArbZG, Projektcontrolling, Rechnungsbelege
- **Betroffene:** Beschäftigte
- **Kategorien:** Mitarbeiter-ID, Datum, Projekt, Stunden, Pause, Tätigkeitsnotiz
- **Empfänger:** Cloudflare
- **Drittlandübermittlung:** USA auf Basis DPF + SCC
- **Löschfrist:** 6 Jahre (§ 147 Abs. 3 AO), danach regelmäßige Löschung
- **Rechtsgrundlage:** § 26 Abs. 1 BDSG, Art. 6 Abs. 1 lit. c DSGVO
- **TOM-Referenz:** siehe `tom-template.md`

### 3. HR-Gespräche

- **Zweck:** Dokumentation von Mitarbeitergesprächen, Nachvollziehbarkeit
- **Betroffene:** Beschäftigte, Führungskräfte
- **Kategorien:** Mitarbeiter-ID, Verfasser-Label, Zeitstempel, Freitext
  (potenziell besondere Kategorien nach Art. 9 DSGVO)
- **Empfänger:** Cloudflare
- **Drittlandübermittlung:** USA auf Basis DPF + SCC
- **Löschfrist:** [TBD] — Vorschlag 3 Jahre ab letzter Änderung
- **Rechtsgrundlage:** § 26 Abs. 1 BDSG, Art. 6 Abs. 1 lit. f DSGVO
- **Besondere Hinweise:** DSFA-pflichtig (Art. 35 Abs. 3 lit. b),
  Betriebsrats-Mitbestimmung (BetrVG § 87 Abs. 1 Nr. 6)

### 4. Activity-Log

- **Zweck:** IT-Sicherheit, Missbrauchserkennung, Protokollpflicht
- **Betroffene:** Beschäftigte
- **Kategorien:** Kürzel, Modul-ID, Zeitstempel, Aktionstyp
- **Empfänger:** Cloudflare
- **Drittlandübermittlung:** USA auf Basis DPF + SCC
- **Löschfrist:** 90 Tage, technisch erzwungen
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO

### 5. Projekt- und Finanzdaten

- **Zweck:** Projektmanagement, Rechnungsstellung, Kostenermittlung
- **Betroffene:** regelmäßig keine; mittelbar bei "Bearbeitet von"
- **Kategorien:** Projektdaten, Beträge, Mengen, "Bearbeitet von"
- **Löschfrist:** 10 Jahre (§ 257 HGB, § 147 AO)
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b, c, f DSGVO

### 6. Kostenermittlungs-Datenbank Ergänzungen

- **Zweck:** Erfassung firmeneigener Kalkulationsdaten
- **Betroffene:** keine
- **Kategorien:** Kalkulationsdaten (keine personenbezogen)
- **Löschfrist:** bis Zurücksetzung durch Betreiber
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO
