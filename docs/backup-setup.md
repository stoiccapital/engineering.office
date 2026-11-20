# Backup-Setup

Der Backup-Endpoint ist deployt. Damit er stündlich läuft, musst du im
Cloudflare-Dashboard zwei Dinge einrichten:

1. **Shared Secret** auf dem Pages-Projekt setzen
2. **Scheduled Worker** als Cron-Trigger anlegen, der den Endpoint feuert

Beides dauert ~10 Minuten.

## 1. Shared Secret setzen

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **engineering-office** (das Pages-Projekt)
2. Reiter **Settings** → **Environment variables**
3. Unter **Production** → **Add variable**
   - **Variable name**: `BACKUP_SECRET`
   - **Value**: eine **lange zufällige Zeichenkette**, z. B. per
     `openssl rand -hex 32` erzeugt (64 Hex-Zeichen). Speichere den Wert
     in deinem Passwort-Manager — du brauchst ihn gleich nochmal.
   - **Encrypt** aktivieren (Variable wird als Secret gespeichert, nicht im Klartext)
4. **Save**
5. Nächsten Deploy abwarten oder manuell erzwingen (ein Push auf `main` reicht)

Prüfen ob gesetzt:
```
curl https://<deine-pages-url>/api/admin/backup
```
Response sollte `"configured": true` enthalten.

## 2. Scheduled Worker als Cron anlegen

Pages Functions können keine Cron-Trigger — dafür brauchst du einen separaten
kleinen Worker, der nichts tut außer stündlich den Backup-Endpoint zu fetchen.

### Via Dashboard (einfacher)

1. **Workers & Pages** → **Create** → **Create Worker**
2. Name: `engineering-office-backup-trigger`
3. **Deploy** (vorerst Default Hello-World)
4. Nach dem Deploy: **Edit code**
5. Ersetze den Default-Code durch:

```js
export default {
  async scheduled(event, env, ctx) {
    const url = env.BACKUP_URL
    const secret = env.BACKUP_SECRET
    if (!url || !secret) return
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-backup-secret': secret },
    })
    if (!res.ok) {
      console.error(`Backup failed: ${res.status} ${await res.text()}`)
    } else {
      const body = await res.json()
      console.log(`Backup ok: ${JSON.stringify(body)}`)
    }
  },
}
```

6. **Save and deploy**
7. In diesem Worker → **Settings** → **Variables**:
   - `BACKUP_URL` = `https://engineering-office.pages.dev/api/admin/backup`
     (oder deine Custom-Domain)
   - `BACKUP_SECRET` = dieselbe Zufallskette wie in Schritt 1
     (als **Encrypt** markieren)
8. **Settings** → **Triggers** → **Cron Triggers** → **Add Cron Trigger**
   - Expression: `0 * * * *` (stündlich zur Minute 00 UTC)
9. **Save**

### Prüfen ob der Trigger läuft

- In dem Worker → **Logs** → **Begin log stream**
- Zur nächsten vollen Stunde erscheint ein Log-Eintrag `Backup ok: {...}`
- Alternativ direkt testen: auf der Worker-Seite den Button **Send event**
  (Schedule dropdown → **Send event**) klickt den Scheduled-Handler sofort an.

## Zugriff auf Backups

Im KV-Namespace `FORECAST_KV`:

- Suche nach Prefix `bak-` → alle Backups
- Suche nach `bak-YYYY-MM-DD` → alle Stunden eines Tages
- Suche nach `bak-YYYY-MM-DD-HH` → ein bestimmter Stunden-Snapshot
- Jeder Backup-Key hat das Muster `bak-YYYY-MM-DD-HH:<original-key>`

**Wiederherstellung** (manuell im Dashboard):
1. Backup-Key öffnen, Wert kopieren
2. Live-Key öffnen (z. B. `plan-2026`), Wert ersetzen
3. Speichern → nächster App-Load zeigt den Backup-Stand

## Retention

- Behalten: 14 Tage rollend
- Älter als 14 Tage werden bei jedem Backup-Lauf automatisch gelöscht

## Was gesichert wird

- Plan: `plan-*`
- Rechnungsplanung: `rechnungsplan-*`
- Ziele: `ziele-*`
- Umsatz: `umsatz-*`
- Forecast: `forecast-period:*`
- HR: `hr`
- Mitarbeiter: `roster`
- Rollen/Zugriff: `settings:access`
- Logo: `logo`
- Kostenschätzung: `kostenschaetzung`
- Kostenermittlung: `kostenermittlung`
- Datenbank-Overrides: `katalogOverrides`
- Projektliste: `projektliste`

**Nicht gesichert**:
- Activity-Log (`activity-*`) — hat eigene 90-Tage-Retention
- Katalog-Referenzdaten (`katalog_kgk.json`, `katalog_frei.json`) — bundled im Build

## Fehlerfall

Wenn der Backup-Endpoint schief geht:
- Response `failed: [...]` zeigt pro Key an welcher Operation (`read` / `write` / `delete`) gescheitert ist
- Log im Worker zeigt den HTTP-Status der Backup-Antwort
- Betroffene Keys stehen trotzdem im Live-Zustand da (Writes sind idempotent, Fehler blockieren den Rest nicht)

## Backup komplett abschalten

Wenn du es mal pausieren willst:
- Worker **Triggers** → Cron löschen
- ODER `BACKUP_SECRET` im Pages-Projekt entfernen → Endpoint wirft 503,
  Worker loggt den Fehler, läuft aber nicht weiter
