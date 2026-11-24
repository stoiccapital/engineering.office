// Bindings and variables available to every Pages Function.
export interface Env {
  // Postgres connection. In production prefer a Hyperdrive binding; a plain
  // DATABASE_URL secret works too (and is what local dev uses via .dev.vars).
  HYPERDRIVE?: { connectionString: string }
  DATABASE_URL?: string

  // Public base URL used in email links, e.g. https://engineering-office-dkf.pages.dev
  APP_URL?: string

  // Email delivery. RESEND_API_KEY → Resend. Otherwise MAILPIT_URL (local dev)
  // or, as a last resort, links are only written to the function log.
  RESEND_API_KEY?: string
  MAIL_FROM?: string
  MAILPIT_URL?: string

  // "false" lets unverified accounts sign in (not recommended in production).
  REQUIRE_EMAIL_VERIFICATION?: string

  // Shared secret for the cron-driven /api/admin/* endpoints.
  BACKUP_SECRET?: string
}
