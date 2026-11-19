# Löschkonzept · Engineering Office

Grundlage: Art. 5 Abs. 1 lit. e DSGVO (Speicherbegrenzung), § 257 HGB,
§ 147 AO, § 35 BDSG.

## Fristen je Kategorie

| Kategorie | Frist | Rechtsgrundlage | Implementierung |
|-----------|-------|-----------------|-----------------|
| Benutzerkonten / Rollen / Passwörter | mit Beendigung Beschäftigung + 30 Tage | § 26 BDSG | manuell per Admin, Hinweis in HR-Prozess |
| Zeiterfassung | 6 Jahre | § 147 Abs. 3 AO | [TBD] Cron: `/api/retention/daily` |
| HR-Gespräche | 3 Jahre ab letzter Änderung | Vorschlag § 26 BDSG, Betriebsvereinbarung | [TBD] Cron |
| Activity-Log | 90 Tage | Art. 6 Abs. 1 lit. f DSGVO | technisch erzwungen (`functions/api/activity.ts`) |
| Projekt- und Rechnungsdaten | 10 Jahre | § 257 HGB, § 147 AO | archivieren, dann löschen |
| Logo-Datei | bis Austausch | — | manueller Admin-Replace |
| Katalog-Overrides | unbegrenzt bis Reset | — | kein personenbezug |

## Geplante automatische Löschung

- **Activity-Log:** bereits aktiv (90 Tage, in `functions/api/activity.ts` /
  `MAX_DAYS = 90`)
- **Zeiterfassung + Gespräche:** als Cloudflare Scheduled Worker
  einzurichten (siehe "Cron-Job-Vorlage" unten)

## Cron-Job-Vorlage (noch zu implementieren)

```ts
// functions/scheduled/retention.ts  (Cron: täglich 02:00 UTC)
export default {
  async scheduled(_event, env, _ctx) {
    const now = new Date()
    const hrRaw = await env.FORECAST_KV.get('hr')
    if (!hrRaw) return
    const doc = JSON.parse(hrRaw)
    const threeYearsAgo = new Date(now)
    threeYearsAgo.setFullYear(now.getFullYear() - 3)
    const cutoff = threeYearsAgo.toISOString()

    doc.threads = doc.threads.map((t) => ({
      ...t,
      utterances: t.utterances.filter((u) => u.ts >= cutoff),
    }))
    const sixYearsAgo = new Date(now)
    sixYearsAgo.setFullYear(now.getFullYear() - 6)
    const cutoffDate = sixYearsAgo.toISOString().slice(0, 10)
    doc.entries = doc.entries.filter((e) => e.datum >= cutoffDate)

    await env.FORECAST_KV.put('hr', JSON.stringify(doc))
  },
}
```

Aktivierung über `wrangler.toml`:

```toml
[triggers]
crons = ["0 2 * * *"]
```

## Hinweise

- Fristen gelten ab dem Ende des Kalenderjahres, in dem die Aufzeichnung
  entstanden ist (§ 147 Abs. 4 AO).
- Vor Ablauf der Frist dürfen Daten nur gelöscht werden, wenn keine
  Aufbewahrungspflichten entgegenstehen.
- Löschläufe sind zu protokollieren (Rechenschaftspflicht Art. 5 Abs. 2).
