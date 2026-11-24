# Self-hosted Postgres on our own Linux server

The app keeps running on Cloudflare Pages; only the database lives on a Linux
server we control. Unlike a backend running on the same box as its database,
Pages Functions connect **from Cloudflare's network**, whose egress IPs are not
fixed — so the database must be reachable from Cloudflare without opening port
5432 to the internet.

Recommended path: **Postgres bound to localhost → Cloudflare Tunnel →
Hyperdrive → Pages Functions.** No inbound port is opened; Hyperdrive pools
connections and adds caching near the database.

```
Pages Function ──► Hyperdrive ──► Cloudflare Tunnel ──► cloudflared (server) ──► 127.0.0.1:5432 Postgres
```

## 1. Postgres (own database + role in the host's PostgreSQL)

The server already runs PostgreSQL 18 from apt on `127.0.0.1:5432` (Docker is
installed but intentionally disabled). We get a dedicated role and database
in it; other roles cannot connect to ours and `eo` has no rights elsewhere.

```sh
cd /opt/engineering-office-db
(umask 077; [ -s .pgpass ] || openssl rand -base64 48 | tr -d '/+=\n' | head -c 40 > .pgpass)
chown root:root .pgpass && chmod 600 .pgpass
PW="$(cat .pgpass)" && sudo -u postgres psql -v ON_ERROR_STOP=1 -v pw="$PW" <<'SQL'
CREATE ROLE eo LOGIN PASSWORD :'pw';
CREATE DATABASE engineering_office OWNER eo;
REVOKE CONNECT, TEMPORARY ON DATABASE engineering_office FROM PUBLIC;
SQL
unset PW
```

`citext` (used by the schema) is a trusted extension, so the migration can
create it as the database owner. Keep a copy of the password in the password
manager; never paste it in chat or commit it.

## 2. Cloudflare Tunnel + Hyperdrive (Cloudflare account that owns the Pages project)

Follow Cloudflare's guide "Connect to a private database using Tunnel"
(Hyperdrive docs). In short:

1. Zero Trust → Networks → Tunnels: create a tunnel, install/run `cloudflared`
   on the server with the given token (an existing `cloudflared` on the box
   can host an additional route instead).
2. Add a public hostname, e.g. `eo-db.<zone>`, service **TCP** →
   `localhost:5432`.
3. Zero Trust → Access: create an application for that hostname with a
   **Service Token** policy (Hyperdrive authenticates with it).
4. Workers & Pages → Hyperdrive → Create: host `eo-db.<zone>` (Access-protected, no port),
   database `engineering_office`, user `eo`, the password from `.pgpass`,
   plus the Access client id/secret.
5. Pages project → Settings → Bindings → add Hyperdrive binding named
   **`HYPERDRIVE`** (Production and Preview). The app prefers it over
   `DATABASE_URL` automatically.

## 3. Schema + data

Run from a machine that can reach the database (on the server through an
SSH tunnel: `ssh -L 15432:127.0.0.1:5432 root@server`):

```sh
DATABASE_URL='postgres://eo:<password>@127.0.0.1:15432/engineering_office' pnpm db:migrate
# then the KV import from docs/postgres-migration.md (steps 7–8)
```

## 4. Backups (required — nobody else does them for us)

Nightly logical dump with 30-day retention, plus a copy **off the server**:

```sh
cat > /etc/cron.d/engineering-office-db <<'EOF'
15 2 * * * root runuser -u postgres -- pg_dump -Fc engineering_office > /opt/engineering-office-db/backups/eo-$(date +\%F).dump && find /opt/engineering-office-db/backups -name 'eo-*.dump' -mtime +30 -delete
EOF
chmod 644 /etc/cron.d/engineering-office-db
```

Copy `backups/` to storage outside this server (another host, S3/R2, …) —
a dump on the same disk does not survive losing the server. Test a restore
once: `pg_restore -d <scratch db> eo-YYYY-MM-DD.dump`.

The app additionally keeps per-document history (`document_history`) and
refused concurrent saves (`document_conflicts`).

## 5. Checklist

- [ ] `ss -ltn | grep 5432` shows `127.0.0.1` only
- [ ] Pages has the `HYPERDRIVE` binding; `/api/auth/me` returns 200
- [ ] Nightly dump present and copied off-server; one restore tested
- [ ] Server OS updates and disk space monitored (Postgres stops when the disk is full)
