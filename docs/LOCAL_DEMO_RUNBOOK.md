# Local Demo Runbook

Version: 2026-07-16  
Scope: local machine only

## 1. Requirements

- Windows 10/11 with Docker Desktop and Docker Compose v2.
- At least 6 GB free RAM and 8 GB free disk for images and persistent volumes.
- Node.js 24 and pnpm 11.16.0 for quality gates and helper commands.
- Ports `3000`, `5433`, `9000` and `9001` available on loopback.
- No AWS account or cloud credential.

## 2. Installation

From the repository root:

```powershell
pnpm install --frozen-lockfile
docker compose --env-file .env.demo.example config --quiet
```

Do not create or commit `.env` for the Docker demo. The example contains public
local-only values. Change them in an ignored local file if the demo is exposed
beyond the current machine.

## 3. Start

```powershell
pnpm demo:up
docker compose --env-file .env.demo.example ps
```

The first start builds two targets, initializes PostgreSQL and a private MinIO
bucket, applies migrations, seeds demo data/evidence and starts the standalone
production image. Wait until `app`, `db` and `storage` are healthy.

Open:

- Application: `http://127.0.0.1:3000`
- Process health: `http://127.0.0.1:3000/api/health`
- Database readiness: `http://127.0.0.1:3000/api/ready`
- MinIO console: `http://127.0.0.1:9001`

MinIO is for local inspection only. The bucket remains private and object paths
must not be exposed as application links.

## 4. Demo accounts

All accounts use password `LocalDemoOnly-247Home` and synthetic data only.

| Role | Email |
| --- | --- |
| Customer | `customer@example.com` |
| Admin | `admin@example.com` |
| Manager | `manager@example.com` |
| Technician 1 | `technician1@example.com` |
| Technician 2 | `technician2@example.com` |
| Staff (authorization demo) | `staff@example.com` |

These credentials are public local fixtures. They are blocked by the seed in
`NODE_ENV=production` and must never be copied to staging or production.

## 5. Demo scenarios

### Customer

1. Sign in as Customer or register a new synthetic customer.
2. Browse `/products`, select an in-stock variant and compatible installation
   package.
3. Add to cart, use a supported demo district, choose a future slot and checkout
   using COD or manual bank transfer.
4. Open order history and the created order detail.

### Admin and Manager

1. Sign in as Manager and open `/admin/operations`.
2. Inspect orders in multiple states and the audit queue.
3. Open `247H-OPS-DEMO`, assign a suitable technician and confirm the assignment
   audit event.
4. Use payment/order actions only when the server-provided transition permits.

### Technician and evidence

1. Sign in as Technician 1 and open `/technician`.
2. Open `247H-OPS-TECH-DEMO` to preview the seeded private evidence.
3. Exercise `ASSIGNED -> EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED`, add a
   result note and upload JPG/PNG/WebP evidence up to 5 MB.
4. Sign in as Technician 2 and verify the other technician's job/evidence URL is
   unavailable.

Automated production-container validation of these flows:

```powershell
pnpm test:e2e:demo
```

## 6. Reset data

`pnpm demo:reset` is destructive only to the allowlisted local demo database and
the demo bucket's `installation-evidence/` prefix:

```powershell
pnpm demo:reset
```

Close all demo browser tabs and ensure no API action is running before invoking
the command. It resets schema, reapplies committed migrations, seeds
deterministic data/evidence, verifies counts/storage and waits for application
readiness. The wrapper restarts only the application container to clear volatile
session/rate-limit state and stale connections. This is a single-operator local
workflow; it does not restart PostgreSQL/MinIO or delete their volumes. Never
bypass its guards or point its inner command at another database.

To stop without deleting data:

```powershell
pnpm demo:down
```

Do not run `docker compose down -v` unless a human explicitly approves permanent
local demo data deletion.

## 7. Troubleshooting

### A port is already used

Change `APP_PORT`, `POSTGRES_PORT`, `MINIO_API_PORT` or `MINIO_CONSOLE_PORT` in an
ignored copy of `.env.demo.example`, then pass that file to Docker Compose. Keep
`AUTH_URL` and `APP_ORIGIN` identical to the browser origin.

### Bootstrap failed

```powershell
docker compose --env-file .env.demo.example logs db storage storage-init demo-bootstrap
docker compose --env-file .env.demo.example up -d demo-bootstrap app
```

Do not mark a failed migration applied manually. Preserve logs without copying
credentials or customer request bodies.

### Login loops back to login

Use exactly `http://127.0.0.1:3000`. Confirm the app has `LOCAL_DEMO=true` and
`AUTH_SECURE_COOKIES=false`. The server intentionally rejects this cookie mode
for non-loopback URLs.

### Evidence upload fails

Confirm `storage` is healthy, `storage-init` exited zero and bucket
`247-home-demo` exists with anonymous access disabled. Run `pnpm demo:reset` to
recreate deterministic evidence after preserving relevant local logs.

### Inspect status without secrets

```powershell
docker compose --env-file .env.demo.example ps
docker compose --env-file .env.demo.example logs --tail 100 app
```

Do not use `docker compose config` output in shared tickets when a private local
env file contains changed credentials.
