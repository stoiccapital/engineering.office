# DSGVO-Compliance — Engineering Office

Dieses Verzeichnis dokumentiert, welche DSGVO-Themen bereits technisch
umgesetzt sind und welche vom Betreiber organisatorisch zu erledigen
sind.

## Ampel

### ✅ Technisch umgesetzt

- [x] Self-hosted Fonts (keine Google-Font-Requests mehr)
- [x] Security-Header (`public/_headers`): HSTS, CSP, X-Content-Type-Options,
      Referrer-Policy, Permissions-Policy
- [x] Passwort-Hashing mit PBKDF2-SHA-256 (210 000 Iterationen)
      + Timing-safe-Vergleich — selbst-upgradend (bestehende Klartext-Passwörter
      werden beim nächsten erfolgreichen Login automatisch gehasht)
- [x] Automatische Löschung des Activity-Logs nach 90 Tagen
- [x] Rollenbasierte Zugriffskontrolle mit Modul-Granularität
- [x] Hash-basierte öffentliche Routen `/datenschutz` und `/impressum`
      (ohne Login erreichbar)

### 🟠 Durch Betreiber auszufüllen / zu unterschreiben

- [ ] **Impressum-Platzhalter** in `src/components/legal/Impressum.tsx`
      durch echte Werte ersetzen (Firma, Adresse, Register, USt-ID,
      verantwortliche Person)
- [ ] **Verantwortlicher / DPO-Daten** in
      `src/components/legal/Datenschutz.tsx` ersetzen
- [ ] **AVV mit Cloudflare** aktiv zustimmen und ablegen
      (siehe `avv-cloudflare.md`)
- [ ] **Verzeichnis von Verarbeitungstätigkeiten (VVT, Art. 30)** erstellen
      (siehe `vvt-template.md`)
- [ ] **TOM-Dokumentation (Art. 32)** erstellen
      (siehe `tom-template.md`)
- [ ] **Datenschutz-Folgenabschätzung (DSFA, Art. 35)** für HR-Modul
      durchführen (siehe `dsfa-hr-template.md`)
- [ ] **Betriebsvereinbarung** zu Zeiterfassung + HR-Gesprächen mit
      Betriebsrat abstimmen (BetrVG § 87 Abs. 1 Nr. 6)
- [ ] **Löschfristen operativ festlegen** (siehe `retention-policy.md`)
- [ ] **Benennungspflicht DSB prüfen** (§ 38 BDSG ab 20 Personen mit ständiger
      automatisierter Verarbeitung → DSB zwingend)

### 🟡 Noch offen / nächste Code-Iteration

- [ ] Session-Tokens statt Credentials in localStorage (kurze Expiry)
- [ ] Rate-Limiting auf `/api/auth/signin` (Cloudflare WAF-Rule)
- [ ] 2FA für Rollen mit `settings` oder `hr_team_view`
- [ ] Self-Service-Export je Beschäftigte(r) nach Art. 15 DSGVO
- [ ] Anonymisierung von HR-Einträgen bei Mitarbeiter-Löschung
- [ ] Cron-Job zur Löschung von HR-Gesprächen nach Retention-Schedule
- [ ] Protokollierung des Zugriffs auf einzelne HR-Threads (nicht nur
      Modul-Öffnung)
- [ ] Data Localization Suite / EU-only KV prüfen

## Dateien in diesem Verzeichnis

- `README.md` — diese Übersicht
- `avv-cloudflare.md` — Leitfaden zum Cloudflare DPA/AVV
- `vvt-template.md` — Verzeichnis von Verarbeitungstätigkeiten
- `tom-template.md` — Technische und organisatorische Maßnahmen
- `dsfa-hr-template.md` — DSFA für HR-Modul
- `retention-policy.md` — Löschfristen und automatische Löschläufe
- `password-migration.md` — wie Bestandspasswörter automatisch gehasht werden
