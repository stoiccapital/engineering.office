# Auftragsverarbeitungsvertrag (AVV / DPA) mit Cloudflare

## Was zu tun ist

1. Im Cloudflare Dashboard → **Manage Account → Account Home → Legal → Cloudflare Customer DPA**
   aufrufen.
2. DPA + Standardvertragsklauseln (SCCs) elektronisch akzeptieren
   (Checkbox "I agree to the Cloudflare Data Processing Addendum").
3. Bestätigungs-E-Mail als PDF im Betreiber-DMS archivieren.
4. **EU-US Data Privacy Framework (DPF):** prüfen, ob Cloudflare im
   DPF-Register geführt wird (<https://www.dataprivacyframework.gov/>).
   Stand Mitte 2024: ja. Dieser Nachweis gehört zum TIA.

## Zweck der Verarbeitung durch Cloudflare

- Hosting der statischen Web-Assets (Cloudflare Pages)
- Serverless-Ausführung der API (Pages Functions)
- Dauerhafte Speicherung von Projekt-, HR- und Konfigurationsdaten
  (Workers KV, Binding `FORECAST_KV`)

## Typen von Daten

- Beschäftigtendaten (Name, Kürzel, Rolle, Passwort-Hash)
- Arbeitszeitdaten (Datum, Projekt, Stunden, Notizen)
- Freitexte aus HR-Gesprächen (potenziell sensible Kategorien)
- Projekt- und Kostenermittlungsdaten (keine personenbezogen, außer
  "Bearbeitet von")
- Activity-Log (Kürzel + Modul + Zeitstempel, max. 90 Tage)

## Technische Schutzmaßnahmen auf Seiten Cloudflare

- Verschlüsselung in Transit (TLS 1.3)
- Verschlüsselung at Rest (AES-256)
- Zugriff auf KV nur über ausgestellte Account-API-Tokens
- Edge-basiertes DDoS-Schutzniveau nach eigenem SLA

## Pflicht zur Risikobewertung (Schrems II / TIA)

Vor Produktivnutzung ist ein **Transfer Impact Assessment** zu erstellen,
das insbesondere Folgendes dokumentiert:

- Welche Daten in welches Drittland potenziell übermittelt werden (KV ist
  global replizierend)
- Welche Rechtslage im Drittland gilt (USA — FISA 702, EO 12333)
- Welche technischen Zusatzmaßnahmen eingesetzt werden
  (Zusatzverschlüsselung client-seitig, Pseudonymisierung, Access-Logs)
- Welche organisatorischen Zusatzmaßnahmen bestehen (DPA, DPF-Zertifikat,
  Challenge-Prozess bei Behördenauskunft)

## Daten-Lokalisierung (optional)

Cloudflare bietet die **Data Localization Suite** (Enterprise-Feature).
Diese garantiert EU-only Speicherung für KV. Kostenpflichtig; für
Verarbeitung von Beschäftigtendaten dringend empfohlen.
