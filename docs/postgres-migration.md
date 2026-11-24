# Migrating production from KV to Postgres

Goal: move every byte of the production `FORECAST_KV` namespace into Postgres
without losing data, with a rollback path at every step.

## What changes for users

- Sign-in is by **email + password** (any email provider). New people register
  themselves; an admin assigns their role under *Einstellungen → Rollen →
  Konten*, or links them to a Mitarbeiter whose role then applies.
- People who used a **Kürzel + password** sign in once with it via
  "Bisher mit Kürzel angemeldet? Konto umstellen", choose their email and a
  new password, and keep their role and Mitarbeiter link. The same works for
  the old shared role passwords (enter the role name as Kürzel).
- All module data looks exactly as before.

## Data safety guarantees

- `scripts/kv-export.mjs` is **read-only** against KV and dumps *every* key
  (it does not rely on the backup endpoint's key list — that list missed the
  Forecast period keys `YYYY-Qn` and `settings:logo`).
- `scripts/kv-import.mjs` runs in **one transaction** and verifies before
  committing: every KV value is stored byte-for-byte in `kv_archive`, every
  document deep-equals its KV value, every role matches, every old password
  verifies against its new hash, activity counts match. Any mismatch → full
  rollback, nothing written. It refuses to run on a non-empty database.
- Plaintext passwords are not carried into the app tables (roster passwords
  are removed from the roster document and stored hashed). The verbatim
  `kv_archive` copy does still contain them — restrict DB access accordingly,
  or drop that table once the migration is signed off.
- The KV namespace itself is never modified, so the previous deployment keeps
  working on it if you roll back.

## Runbook

1. **Provision Postgres** (e.g. Neon, Supabase, RDS) with automated backups
   enabled. Optionally create a Cloudflare Hyperdrive config for it.
2. **Schema:** `DATABASE_URL='postgres://…' pnpm db:migrate`
3. **Email:** create a Resend API key and verify the sending domain.
4. **Configure the Pages project** (Production *and* Preview): variables from
   `DEPLOY.md` (`DATABASE_URL`/Hyperdrive, `APP_URL`, `RESEND_API_KEY`,
   `MAIL_FROM`; keep `BACKUP_SECRET`).
5. **Rehearse** on a scratch database: run steps 7–8 against it, open a
   preview deployment of this branch pointed at it, convert one Kürzel login,
   click through the modules.
6. **Announce a short write freeze** (e.g. 15 min, evening). Writes made to the
   old app after the export would not be in Postgres.
7. **Export** (needs `wrangler login` with access to the namespace):
   `pnpm kv:export --remote` → `backups/kv-export-<time>.json`
8. **Import into the production database:**
   `DATABASE_URL='…' pnpm kv:import --file backups/kv-export-<time>.json --dry-run`
   then the same without `--dry-run`. Keep the printed report.
9. **Deploy:** merge to `main` (Pages builds and deploys).
10. **Smoke test:** sign in via Kürzel → claim an email account, check a few
    modules, check *Einstellungen → Konten* lists remaining unconverted logins.
11. **Afterwards:** store the export file somewhere safe (it holds old
    plaintext passwords) or delete it; keep the KV namespace untouched for a
    few weeks as a fallback.

## Rollback

Cloudflare Pages → Deployments → roll back to the last KV-based deployment.
It reads the untouched KV namespace; only writes made after the cutover would
need to be re-entered (or copied back from Postgres `documents` by key).
