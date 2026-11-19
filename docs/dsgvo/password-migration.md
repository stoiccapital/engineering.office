# Passwort-Migration auf PBKDF2

## Aktueller Stand

- Alle neu gesetzten Passwörter (über `/api/settings/access` oder
  `/api/roster`) werden vor dem Schreiben nach KV automatisch mit
  PBKDF2-SHA-256 (210 000 Iterationen, 128-Bit-Salt) gehasht.
- Bestehende Klartext-Passwörter in KV werden bei der nächsten
  erfolgreichen Anmeldung des jeweiligen Nutzers automatisch neu als
  Hash geschrieben (selbst-upgradend). Danach ist das Klartext-Passwort
  dauerhaft entfernt.

## Hash-Format

```
$pbkdf2-sha256$<iterations>$<base64-salt>$<base64-hash>
```

- `iterations`: aktuell 210 000 (OWASP 2024 Empfehlung für PBKDF2-SHA256)
- `salt`: 16 Byte zufällig, pro Eintrag separat
- `hash`: 32 Byte

## Verifikation

- Der Vergleich erfolgt **timing-safe** (XOR-basiert, kein `===`).
- Die Verifier-Funktion `verifyPassword` ist unter
  `functions/_lib/password.ts` implementiert.

## Forcierte sofortige Migration (optional)

Sollte der Betreiber nicht abwarten wollen, bis jeder Nutzer sich wieder
einloggt, kann ein einmaliger Admin-Reset aller Passwörter gefahren
werden:

1. Alle Passwörter per Admin-UI auf ein Übergangspasswort setzen
   (wird beim Speichern bereits gehasht).
2. Jeden Beschäftigten schriftlich zur Erstanmeldung + anschließender
   eigener Vergabe auffordern.

Alternativ ein einmaliges Node-Skript, das alle Klartext-Passwörter aus
der KV-Konfiguration liest, hasht und zurückschreibt. Beispiel:

```ts
import { hashPassword, isHashed } from '../functions/_lib/password'
// ... fetch config, for each role/user: if (!isHashed(p)) p = await hashPassword(p)
// ... put back
```

(Nicht im Repo enthalten, da einmalig und Account-spezifisch.)
