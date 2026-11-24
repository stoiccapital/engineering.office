-- Optimistic concurrency: a save based on an outdated version is rejected,
-- and the rejected payload is kept here so nobody's edits are silently lost.
create table document_conflicts (
  id                bigserial primary key,
  key               text not null,
  based_on_version  integer not null,
  current_version   integer not null,
  data              jsonb not null,
  user_id           uuid references users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index document_conflicts_key_idx on document_conflicts(key, created_at desc);

-- Failed sign-in attempts for flows without a user row to count on
-- (the legacy Kürzel login). key = '<scope>:<identifier>'.
create table auth_throttle (
  key           text primary key,
  failures      integer not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);
