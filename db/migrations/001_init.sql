-- Initial Postgres schema. Replaces the Cloudflare KV namespace FORECAST_KV.
--
-- Module data (plan, ziele, rechnungsplan, projektliste, …) keeps its exact
-- JSON shape in `documents` so the frontend contract stays unchanged; identity,
-- access control, sessions and the activity log are proper relational tables.

create extension if not exists citext;

-- Roles carry the module matrix. Ids are kept verbatim from the KV
-- `settings:access` config so roster entries (employee.roleId) keep resolving.
create table roles (
  id                    text primary key,
  name                  text not null,
  modules               text[] not null default '{}',
  -- Shared role password from the KV era (hashed). Only used by the one-time
  -- legacy sign-in that lets an existing person claim an email account.
  legacy_password_hash  text,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table users (
  id                  uuid primary key default gen_random_uuid(),
  email               citext not null unique,
  password_hash       text not null,
  display_name        text not null default '',
  email_verified_at   timestamptz,
  -- 'active' | 'disabled'. Users without a role are "waiting for approval".
  status              text not null default 'active' check (status in ('active', 'disabled')),
  role_id             text references roles(id) on delete set null,
  -- Link to a roster employee (documents['roster'].employees[].id). When set,
  -- the role follows the employee's roleId from the Mitarbeiter screen.
  employee_id         text unique,
  failed_login_count  integer not null default 0,
  locked_until        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_login_at       timestamptz
);

create table sessions (
  -- sha256(token) hex; the raw token only lives in the HttpOnly cookie.
  id            text primary key,
  user_id       uuid not null references users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now(),
  user_agent    text
);
create index sessions_user_idx on sessions(user_id);
create index sessions_expires_idx on sessions(expires_at);

-- One-time tokens: email verification, password reset, legacy account claim.
create table auth_tokens (
  token_hash  text primary key,
  purpose     text not null check (purpose in ('verify_email', 'reset_password', 'claim_legacy')),
  user_id     uuid references users(id) on delete cascade,
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index auth_tokens_user_idx on auth_tokens(user_id);

-- Kürzel + password logins carried over from KV (roster employees and the
-- older settings:access users). Passwords are hashed during import. A row
-- becomes inert once someone claims it with an email account.
create table legacy_logins (
  id                  bigserial primary key,
  -- Not unique: the old roster allowed two people with the same Kürzel
  -- (told apart by password), so the import keeps every entry.
  kuerzel             text not null,
  password_hash       text not null,
  display_name        text not null default '',
  employee_id         text,
  role_id             text references roles(id) on delete set null,
  source              text not null check (source in ('roster', 'access_users')),
  claimed_by_user_id  uuid references users(id) on delete set null,
  claimed_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index legacy_logins_kuerzel_idx on legacy_logins(kuerzel);

-- Module documents, one row per former KV key (same key names).
create table documents (
  key         text primary key,
  data        jsonb not null,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references users(id) on delete set null
);

-- Previous versions of documents, so no save can silently destroy data.
create table document_history (
  id          bigserial primary key,
  key         text not null,
  version     integer not null,
  data        jsonb not null,
  reason      text not null check (reason in ('edit', 'snapshot', 'import')),
  changed_at  timestamptz not null default now(),
  changed_by  uuid references users(id) on delete set null
);
create index document_history_key_idx on document_history(key, changed_at desc);

create table activity_events (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  user_id     uuid references users(id) on delete set null,
  user_label  text not null,
  kind        text not null check (kind in ('login', 'view', 'action')),
  module      text,
  action      text,
  target      text
);
create index activity_events_ts_idx on activity_events(ts desc);

-- Verbatim copy of every key/value exported from KV at migration time,
-- including hourly bak-* snapshots. Never modified by the app; it is the
-- audit trail proving the import lost nothing.
create table kv_archive (
  key          text primary key,
  value        text not null,
  imported_at  timestamptz not null default now()
);
