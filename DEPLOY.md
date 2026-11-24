# Deploy

Static Vite SPA + Pages Functions (API) on Cloudflare Pages, with **PostgreSQL**
as the database and **email accounts** for sign-in.

Moving an existing KV-based deployment over? Follow
[docs/postgres-migration.md](docs/postgres-migration.md) — it is written so no
data is lost.

## Local development

Requirements: Node 20+, Docker.

```sh
pnpm install
cp .dev.vars.example .dev.vars      # DATABASE_URL, MAILPIT_URL, BACKUP_SECRET
pnpm db:up                           # Postgres :54329 + Mailpit (UI http://localhost:8026)
pnpm db:migrate
pnpm build && pnpm dev:full          # app + API on http://localhost:8788
pnpm test:api                        # end-to-end API tests (wipes the LOCAL db)
```

Frontend and API share one origin/port: `wrangler pages dev` serves `dist/`
and runs `functions/` for `/api/*`. After frontend changes run `pnpm build`
again; function changes reload automatically. `pnpm dev` (Vite, :5173) still
works for UI-only work with in-browser mock data.

Every email the app sends locally (verification, password reset) shows up in
Mailpit at <http://localhost:8026>.

The first account registered on an **empty** database becomes admin. On a
migrated database, existing people convert their old Kürzel login into an
email account from the sign-in screen ("Bisher mit Kürzel angemeldet?").

## Production configuration (Pages → Settings → Variables and Secrets)

| Name | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes* | Postgres connection string (secret). *Or a Hyperdrive binding named `HYPERDRIVE` (recommended for latency/pooling). |
| `APP_URL` | no | Public base URL used in email links, e.g. `https://engineering-office-dkf.pages.dev` |
| `RESEND_API_KEY` | no — off by default (`REQUIRE_EMAIL_VERIFICATION = "false"` in wrangler.toml; no confirmation or reset mails) | Email delivery via [Resend](https://resend.com) (secret). The sending domain must be verified in Resend to deliver to arbitrary addresses (Gmail, company domains, GMX, …). |
| `MAIL_FROM` | with Resend | e.g. `Engineering Office <no-reply@your-domain.de>` (domain verified in Resend) |
| `BACKUP_SECRET` | yes | Shared secret for the cron endpoints `/api/admin/backup` and `/api/admin/weekly-rollover` (unchanged) |
| `REQUIRE_EMAIL_VERIFICATION` | no | Default on. Set to `false` only for testing. |

Apply schema migrations before deploying code that needs them:

```sh
DATABASE_URL='postgres://…' pnpm db:migrate
```

Build settings are unchanged: preset Vite, build `pnpm build`, output `dist`,
Node 20. `wrangler.toml` enables `nodejs_compat` (needed by the Postgres
driver).

## Backups

Full-database backups/point-in-time recovery come from the Postgres provider
(enable them there). In addition the app keeps restore points itself: every
document overwrite stores the previous version in `document_history`
(at most one row per document per 10 minutes), and the hourly cron
(`docs/backup-setup.md`, unchanged URL and header) snapshots changed documents.
