# Local Demo Readiness Report

Status: **LOCAL DEMO READY**  
Validated: 2026-07-16  
Scope: local Docker Desktop only; no cloud deployment was performed.

## Executive result

247 Home now runs as a production-like Next.js standalone container with a
persistent PostgreSQL 16 database and private S3-compatible MinIO storage. A
one-shot tools container applies all committed migrations, seeds deterministic
demo data and evidence, and verifies the baseline before the application starts.
The application runs as a non-root user with a read-only root filesystem,
dropped capabilities, a database readiness healthcheck and loopback-only ports.

The final local stack is available at `http://127.0.0.1:3000`. Database and
storage volumes remain persistent across normal shutdowns.

## Requirement matrix

| Requirement | Evidence | Result |
| --- | --- | --- |
| Docker Compose starts application, PostgreSQL and storage | `docker-compose.yml`; `pnpm demo:up` | PASS |
| Production-like, non-root application with healthcheck | `Dockerfile`; Docker inspect reported `nextjs`, read-only root, `cap_drop=ALL`, `no-new-privileges`, healthy | PASS |
| Persistent PostgreSQL and automatic migrations | `postgres-data`; `demo-bootstrap`; 11 migrations applied/no pending | PASS |
| Private S3-compatible local storage | MinIO bucket `247-home-demo`; anonymous policy `private` | PASS |
| No AWS/cloud dependency | Compose uses only loopback PostgreSQL/MinIO/application endpoints | PASS |
| Checked-in environment contract without real secrets | `.env.demo.example`; `.env` remains ignored | PASS |
| Deterministic reset/migrate/seed workflow | `pnpm demo:reset`; local DB/bucket allowlists and application restart | PASS |
| Required demo identities | Customer, Admin, Manager and two Technicians verified | PASS |
| Catalog dataset | 12 products and existing installation/service-area data | PASS |
| Multiple order and appointment states | Two order states and two appointment states verified | PASS |
| Evidence and audit history | One private demo evidence object and three seed audit events verified | PASS |
| Customer register/login/browse/cart/checkout | Demo registration E2E plus checkout happy/out-of-stock E2E | PASS |
| Admin payment and Operations flow | Payment, assignment, reschedule and audit E2E | PASS |
| Technician workflow and evidence | Full state workflow, upload/preview and IDOR E2E | PASS |
| Full quality gates | lint, typecheck, unit, integration, migration, E2E and build | PASS |

## Implementation files

| Area | Files |
| --- | --- |
| Container runtime | `Dockerfile`, `docker-compose.yml`, `.dockerignore` |
| Environment contract | `.env.example`, `.env.demo.example`, `.gitignore` |
| Demo commands | `package.json`, `scripts/demo-runtime.ts`, `scripts/demo-bootstrap.ts`, `scripts/demo-compose-reset.ts`, `scripts/demo-reset.ts`, `scripts/demo-storage-clean.ts`, `scripts/demo-seed-evidence.ts`, `scripts/demo-verify.ts` |
| Demo data | `prisma/seed.ts` |
| Loopback Auth security | `src/shared/validation/env.ts`, `src/modules/identity/infrastructure/auth-options.ts` |
| S3-compatible storage contract | `src/modules/storage/object-storage-adapter.ts`, `src/modules/storage/storage-factory.ts` |
| Tests | `playwright.demo.config.ts`, `tests/demo/local-demo-storage.spec.ts`, `tests/unit/demo-runtime.test.ts`, related environment/storage tests and canonical demo-email updates |
| Documentation | `README.md`, `docs/LOCAL_RUNTIME_AUDIT.md`, `docs/LOCAL_DEMO_RUNBOOK.md`, this report |

No production dependency was added. MinIO server/client are pinned local
infrastructure images. Existing AWS SDK dependencies provide the same storage
adapter used for S3-compatible endpoints.

## Database and storage actions

- Reset only the allowlisted local database `home247` on `127.0.0.1`.
- Applied all 11 committed Prisma migrations; no migration file or database
  architecture was changed by this slice.
- Seeded synthetic development/demo records only.
- Deleted only object keys below `installation-evidence/` in a bucket whose name
  contains `demo`, then uploaded one deterministic PNG through the real S3
  adapter.
- Restarted only the application container after reset to clear stale database
  pools, sessions and in-memory rate limits. PostgreSQL and MinIO were not
  restarted and their volumes were not removed.

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS; lockfile current, pnpm 10.32.1 |
| `docker compose --env-file .env.demo.example config --quiet` | PASS |
| `pnpm demo:up` | PASS; images built, bootstrap completed, stack started |
| `pnpm demo:reset` | PASS repeatedly; migrate, seed, evidence, verify, app restart |
| `pnpm db:migrate` | PASS; 11 migrations, no pending migration |
| `pnpm lint` | PASS; zero warnings |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS; 19 files, 70 tests |
| `pnpm test:integration` | PASS; 7 files, 53 tests on PostgreSQL |
| `pnpm test:migration` | PASS; valid upgrade and invalid-history rollback |
| `pnpm test:e2e` | PASS; 14/14 |
| `pnpm test:e2e:demo` | PASS; 16/16 against production container and MinIO |
| `pnpm build` | PASS; optimized Next.js production build |
| `/api/health` and `/api/ready` | PASS; HTTP 200 |

The repeat E2E run initially exposed retained in-memory login limits. The final
reset contract now restarts only the application container; both E2E suites then
passed from independent deterministic baselines without weakening rate limits.
Using `127.0.0.1` instead of `localhost` also avoids IPv6 fallback against the
IPv4-only Docker port binding.

## Security checks

- Runtime user is `nextjs` (UID 1001), root filesystem is read-only, Linux
  capabilities are dropped and `no-new-privileges` is enabled.
- PostgreSQL, application, MinIO API and console bind only to `127.0.0.1`.
- The MinIO bucket is private; evidence preview still passes server-side
  assignment authorization and cross-technician access returns 404.
- Plain-HTTP Auth cookies are allowed only when `LOCAL_DEMO=true` and both Auth
  and application origins are loopback. Non-loopback production use fails fast.
- `.env` remains ignored. A high-confidence scan found no access key or private
  key pattern in the local-runtime files.
- Public values in `.env.demo.example` are explicitly local fixtures and are not
  valid production credentials.

## Manual verification

The automated gates cover the required role flows. For a live demonstration,
follow `docs/LOCAL_DEMO_RUNBOOK.md`: sign in with each documented account,
inspect Operations and Technician pages, complete an installation, preview its
evidence, and inspect the corresponding audit event. The MinIO console may be
used only to inspect the private local bucket.

## Remaining risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Public demo passwords are known | Low/local only | Ports bind to loopback; never expose this Compose stack or reuse values outside local demo |
| Reset is destructive to `home247` | Medium/operator | Explicit `LOCAL_DEMO` and `DEMO_RESET_ALLOWED` guards, host/database allowlist, single-operator runbook warning |
| Docker Desktop interruption can stop containers | Low | Re-run `pnpm demo:up`; named volumes retain PostgreSQL and MinIO data |
| In-memory rate limits are process-local | Low/local | `demo:reset` restarts app for a deterministic demo; production architecture uses external controls defined elsewhere |
| MinIO console is available on loopback | Low | Keep loopback binding and local credentials; do not expose port 9001 |
| Prisma 6 reports deprecated `package.json#prisma` configuration | Low | Migrate to `prisma.config.ts` during the planned Prisma major-version work, not this runtime-only slice |
| No local automated backup | Low/demo data | Dataset is reproducible with `pnpm demo:reset`; do not store irreplaceable data in this stack |

## Rollback

Stop the stack with `pnpm demo:down`; this preserves named volumes. Revert the
Compose/demo tooling and local documentation to remove the capability. No
schema rollback, enum drop, cloud teardown or data deletion is required. Do not
run `docker compose down -v` unless permanent deletion of local demo data is
explicitly approved.

## Conclusion

**LOCAL DEMO READY.** The required customer, admin and technician workflows run
on a fully local production-like Docker stack with PostgreSQL and private MinIO,
and all final quality gates pass.
