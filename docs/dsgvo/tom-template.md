# Technische und organisatorische Maßnahmen (TOM) · Art. 32 DSGVO

Stand: [TBD]

## 1. Vertraulichkeit

### 1.1 Zutrittskontrolle (physisch)

- Rechenzentren von Cloudflare: ISO 27001, SOC 2 Typ II (Cloudflare-Audit-Berichte
  einsehbar über Cloudflare-Vertrauenszentrum)

### 1.2 Zugangskontrolle (logisch)

- Rollenbasierte Zugangssteuerung (Modul-granular)
- Passwörter mit PBKDF2-SHA-256 (210 000 Iterationen) gehasht
- Timing-safe-Vergleich aller Passwort-Prüfungen
- Automatisches Re-Hashing bestehender Klartext-Passwörter bei erfolgreichem
  Login (Übergangsphase)
- [TBD: Rate-Limiting auf `/api/auth/signin` via Cloudflare WAF-Rule]
- [TBD: 2FA für Rollen mit `settings` oder `hr_team_view`]

### 1.3 Zugriffskontrolle

- Jede API-Route erzwingt Modul-Zugehörigkeit per Middleware
- Protokollierung der Modul-Zugriffe (Activity-Log, 90 Tage)
- [TBD: Protokollierung von Zugriffen auf einzelne HR-Threads]

### 1.4 Trennungskontrolle

- Pro Mandant eine KV-Namespace-Instanz
- Datenbank-Overlay (`katalogOverrides`) pro Betreiber getrennt vom
  bundled Ril-808-Referenzdatensatz

## 2. Integrität

### 2.1 Weitergabekontrolle

- TLS 1.3 auf allen HTTP-Verbindungen (HSTS, max-age 2 Jahre)
- Content-Security-Policy, X-Content-Type-Options `nosniff`,
  X-Frame-Options `DENY`
- Referrer-Policy `strict-origin-when-cross-origin`

### 2.2 Eingabekontrolle

- Alle Schreibzugriffe gehen über die Middleware
- Änderungen an Rollen/Mitarbeitern werden im Activity-Log protokolliert
- Projekt- und Finanzdaten tragen `updatedAt`-Zeitstempel

## 3. Verfügbarkeit und Belastbarkeit

- Cloudflare-SLA 100 % Edge-Verfügbarkeit (Workers)
- KV repliziert automatisch über mehrere Regionen
- Serverless-Architektur ohne lokale Zustandsabhängigkeiten

## 4. Verfahren zur regelmäßigen Überprüfung, Bewertung und Evaluierung

- Jährliche Überprüfung dieses TOM-Dokuments durch Betreiber
- Codebasis wird in GitHub versioniert; Audit-Historie nachvollziehbar
- Dependency-Updates über `pnpm audit` regelmäßig geprüft

## 5. Verschlüsselung

- Transport: TLS 1.3 (durch Cloudflare erzwungen)
- Ruhezustand: AES-256 (durch Cloudflare KV)
- Passwörter: PBKDF2-SHA-256 Hash mit zufälligem Salt pro Eintrag

## 6. Pseudonymisierung

- Interne IDs sind UUIDs ohne personenbezogene Bedeutung
- [TBD: Anonymisierung von HR-Einträgen bei Beschäftigten-Löschung]
