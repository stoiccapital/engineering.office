# Self-hosted Postgres on our own Linux server

The app keeps running on Cloudflare Pages; only the database lives on a Linux
server we control. Unlike a backend running on the same box as its database,
Pages Functions connect **from Cloudflare's network**, whose egress IPs are not
fixed — so the database must be reachable from Cloudflare without opening port
5432 to the internet.

Recommended path: **Postgres bound to localhost → Cloudflare Tunnel →
Workers VPC service → Hyperdrive → Pages Functions.** No inbound port is
opened, no public hostname/domain and no Access service token are needed;
Hyperdrive pools connections near the database.

```
Pages Function ──► Hyperdrive ──► Workers VPC service ──► Tunnel ──► cloudflared (server) ──► 127.0.0.1:5432 Postgres
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

## 2. Tunnel + Workers VPC + Hyperdrive (account that owns the Pages project)

See Cloudflare's "Connect to a private database using Workers VPC"
(Hyperdrive docs). In the dashboard:

1. Compute → VPC → Tunnels → create a tunnel; run the shown install command
   on the server (installs `cloudflared` as a service with the tunnel token —
   the token is a secret, don't paste it anywhere else).
2. Compute → VPC → Services → create a **TCP** service on that tunnel:
   host `127.0.0.1` (IPv4), port `5432`.
3. Storage & databases → Hyperdrive → Create → *Connect to private
   database* → *Workers VPC* → pick the service; database
   `engineering_office`, user `eo`, the password from `.pgpass`. The last hop
   is localhost on the server and the host Postgres uses Ubuntu's
   self-signed cert, so set certificate verification to *disabled*
   (the tunnel itself is encrypted).
4. Pages project → Settings → Bindings → add Hyperdrive binding named
   **`HYPERDRIVE`** (Preview first, Production at cutover). The app prefers it
   over `DATABASE_URL` automatically.

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
