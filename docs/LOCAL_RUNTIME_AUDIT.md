# Local Runtime Audit

Status: **VALIDATED**  
Date: 2026-07-16

## Scope

This audit covers only the local production-like and demo runtime. It creates no
cloud resource, changes no business state machine and introduces no alternate
database or mocked business service.

## Runtime inventory

| Concern | Existing state | Gap | Implemented local contract |
| --- | --- | --- | --- |
| Application | Next.js standalone multi-stage image, Node 24, non-root runtime and process healthcheck | Application was absent from Compose | Compose builds the `runtime` target, runs production mode as UID 1001, uses a read-only filesystem, drops capabilities and checks `/api/ready` |
| Database | PostgreSQL 16 with Prisma migrations and persistent Docker volume | Only service available in Compose; no automatic application bootstrap | Private Compose service with loopback host port, healthcheck, persistent volume and one-shot `prisma migrate deploy` |
| Storage | Private storage port with local and S3-compatible adapters | Production image rejects filesystem storage; no local S3 service | Private MinIO bucket initialized with anonymous access disabled; application uses the same AWS SDK S3 adapter as cloud environments |
| Migration | Runtime image intentionally excludes Prisma CLI | No safe migration process before app start | Separate `demo-tools` image contains the pinned development toolchain; bootstrap must complete before app starts |
| Seed | Idempotent development seed with products and Operations data | Demo account names, multiple order states and stored evidence were incomplete | Exact synthetic demo accounts, 12 products, multiple order/appointment states, assignment, audit history and private evidence |
| Reset | No project reset command | Demo could not return to a deterministic baseline | `pnpm demo:reset` requires an idle single-operator demo, invokes a guarded local-only database/storage reset, restarts only the application process to clear volatile runtime state and waits for readiness without deleting Docker volumes |
| Authentication | Production mode always selected Secure cookies | Plain HTTP loopback demo could not retain an Auth.js session | `AUTH_SECURE_COOKIES=false` is accepted only with `LOCAL_DEMO=true` and loopback Auth/origin URLs; every non-loopback production attempt fails fast |

## Start flow

```text
docker compose up --build
  -> PostgreSQL healthy
  -> MinIO healthy
  -> private bucket bootstrap completes
  -> demo-tools runs migrate deploy, idempotent seed, evidence seed and verification
  -> production standalone application starts
  -> /api/ready verifies PostgreSQL before container health becomes healthy
```

The application runtime image contains neither package manager nor Prisma CLI.
Migration does not run in application startup and there is no network call in a
database transaction.

## Environment audit

`.env.demo.example` is a public local-demo contract, not a secret source. It
contains `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, aggregate `STORAGE_CONFIG`
documentation and the expanded MinIO variables consumed by Compose/application.
The checked-in values are intentionally local and must never be reused for a
shared or production environment.

Compose provides all required runtime variables explicitly. The server still
validates database URL, Auth secret/URL, origin, proxy policy, cookie policy and
storage configuration. Missing or invalid values fail before serving protected
workflows.

## Database reset safety

The destructive inner reset accepts only:

- `LOCAL_DEMO=true`;
- `DEMO_RESET_ALLOWED=true`;
- non-production Node runtime;
- PostgreSQL host `db`, `localhost` or `127.0.0.1`;
- database `home247` or `home247_demo`.

Storage cleanup accepts only a local MinIO hostname, a bucket containing
`demo`, and deletes only the `installation-evidence/` prefix. Reset is restricted
to a single local operator with no browser/API traffic; the wrapper restarts only
the application container and waits for a fresh database pool, session cache and
rate-limit memory to become ready. Reset tooling runs on the host against the
loopback PostgreSQL and MinIO ports. It does not restart PostgreSQL/MinIO, remove
volumes, touch databases outside the allowlist or delete arbitrary object keys.

## Dependency decision

No npm dependency was added. MinIO server and client use reviewed, immutable
container image tags plus multi-platform digests. MinIO is local infrastructure,
not application business logic. Removal consists of reverting Compose, demo
scripts and documentation; the application S3 adapter remains valid for AWS.

## Validation outcome

The production-like image build, Compose health, automatic migration/seed,
guarded reset, private MinIO evidence authorization, complete Playwright suites
and canonical quality gates passed on 2026-07-16. Detailed command evidence and
remaining local-only risks are recorded in
`docs/LOCAL_DEMO_READINESS_REPORT.md`.
