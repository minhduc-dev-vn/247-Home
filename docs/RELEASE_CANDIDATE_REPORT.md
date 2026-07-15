# 247 Home Release Candidate Report

Report date: 2026-07-15, Asia/Bangkok

## Decision

**RELEASE CANDIDATE READY FOR STAGING**

Critical findings: 0. High findings: 0. Open Medium security/integrity
findings: 0. All required database, unit, integration, migration-upgrade, E2E,
and build gates pass on the current workspace after the latest migration.

The workspace still has no `.git` directory. Branch provenance, tracked-secret
history, and the exact release diff therefore remain a human staging-entry
check rather than verified repository evidence.

## Audit Finding Matrix

| Finding | Status | Implementation | Regression/evidence |
|---|---|---|---|
| ENV-H-01 DB gates unavailable | FIXED | `docker-compose.yml`, local Docker Desktop/PostgreSQL 16 | Fresh migrate, integration, migration-upgrade and E2E pass |
| SEC-H-01 inconsistent mutation security | FIXED | `src/shared/http/api-handler.ts`; auth/cart/checkout/catalog/inventory/payment routes | `tests/unit/api-handler.test.ts`, identity integration, full E2E |
| ORD-H-01 technician completion bypasses payment | FIXED | `src/modules/operations/application/operations-service.ts` | `tests/integration/operations.test.ts`, technician workflow E2E |
| PAY-H-01 manual payment action missing | FIXED | payment policy/service, `/api/v1/admin/payments/[id]/actions` | payment unit/integration/E2E tests |
| PERF-M-01 unbounded lists | FIXED | commerce/catalog list schemas and services | pagination schema tests, checkout/reschedule E2E |
| SCM-M-01 Git evidence unavailable | NOT FIXED, environment evidence only | No `.git` metadata supplied | Must verify in the real remote checkout before staging promotion |
| SUP-M-01 transitive advisories | FIXED | `pnpm.overrides`, lockfile, bulk advisory audit script and CI gate | 148 production packages audited; no moderate-or-higher advisory |
| OBS-M-01 structured logging absent | FIXED | `src/shared/observability/logger.ts`, HTTP handler instrumentation | `tests/unit/observability.test.ts` |
| SEC-M-02 process-local rate limiter | FIXED for remediation contract | pluggable `RateLimiter` interface; in-memory local/test adapter | adapter contract unit test; shared provider remains deployment configuration |
| DOC-M-01 stale docs | FIXED | README, API contract, order state machine, this report | format check |
| DOC-L-01 pagination contract drift | FIXED | `docs/API_CONTRACT.md` | pagination schema tests and E2E consumers |
| TOOL-L-01 Prisma package config warning | OPEN LOW | `package.json#prisma` still supported by Prisma 6 | Move to `prisma.config.ts` before Prisma 7 |
| SEC-L-01 local `.env` tracking evidence | OPEN LOW | `.gitignore` excludes secrets; `.env.example` remains non-secret | Verify Git history in the real checkout |

## Remediation Summary

### Payment and Operations integrity

- Added payment states including `REFUNDED` and a forward-only migration with
  rollback/forward-fix notes.
- Added centralized `CONFIRM_PAYMENT` and `REJECT_PAYMENT` policy for
  STAFF/MANAGER/ADMIN.
- Payment update uses row locking plus conditional `id + version + status`
  write. Version increment and audit are in the same transaction.
- Technician completion locks appointment and order, requires payment `PAID`,
  and atomically updates order, appointment, assignment, timestamps, and audit.
- Existing ARRIVED transition, assignment ownership, exclusion constraint,
  evidence authorization, inventory transaction, and order concurrency rules
  remain intact.

### Security and bounded reads

- All sensitive custom mutation routes now use shared Origin, Content-Type,
  body-size, rate-limit, structured-error, and no-store enforcement.
- Rate limiting is adapter-based; local/test uses deterministic memory state.
- Customer orders, addresses, installation slots, and service areas use cursor
  pagination, stable ordering, default limit 25, maximum 100. Slot date ranges
  are capped at 31 days.
- Structured HTTP logs contain only request ID, method, path without query,
  status, duration, and timestamp.

### Supply chain

- Pinned transitive `postcss` to `8.5.18` and `uuid` to `11.1.1` because the
  latest direct `next` and `next-auth` releases still declared vulnerable
  transitive ranges.
- npm retired the legacy audit endpoints used by pnpm 10 and 11 during the
  final run (HTTP 410). CI now calls npm's required bulk advisory endpoint via
  `scripts/audit-production-dependencies.ts` and fails on moderate or higher.

## Migration Strategy

Migration `20260714130000_payment_workflow` is additive and forward-only. It
adds enum value `REFUNDED` and nullable `confirmation_reference`; it does not
rewrite or delete existing payment/order/Operations data. Existing migration
history was not edited. Rollback is by application rollback or a new forward
fix, never enum/data deletion.

## Commands and Results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm db:up` | PASS; PostgreSQL 16 container healthy |
| `pnpm db:migrate` | PASS; 9 migrations, no pending migration |
| `pnpm db:seed` | PASS; repeatable development seed |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS; 14 files, 47 tests |
| `pnpm test:integration` | PASS; 7 files, 41 tests on PostgreSQL |
| `pnpm test:migration` | PASS; valid upgrade and invalid-history rollback |
| `pnpm test:e2e` | PASS; 14/14 on a fresh server after latest migration |
| `pnpm audit:prod` | PASS; 148 production packages, 0 moderate-or-higher advisories |
| `pnpm build` | PASS; Next.js production build and TypeScript complete |

The raw `pnpm audit --prod` command was also attempted and failed because npm
returned HTTP 410 for both legacy endpoints. It reported no advisory payload;
the replacement bulk-endpoint gate above passed.

## Important Test Coverage

- Concurrent order transition: one success, one conflict, one audit.
- Inventory reservation consume and transaction rollback paths.
- Concurrent payment confirmation: one success, one conflict, one audit.
- Unpaid technician completion: rejected with no partial state/audit.
- Concurrent assignment, reschedule, technician action, and exclusion guard.
- Manager payment confirmation E2E and stale retry conflict.
- Full technician ASSIGNED -> EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED.
- Cross-technician read/action denial, reschedule conflict, evidence preview,
  fixture failure cleanup, and authenticated no-store responses.

## Files Changed by Remediation

- Prisma: `prisma/schema.prisma`, payment migration/rollback notes, `prisma/seed.ts`.
- Commerce/Operations: payment policy/service/route, order repository locks,
  technician payment guard, pagination services and schemas.
- HTTP/security: shared mutation wrapper, rate-limiter interface, structured
  logger, all sensitive mutation route migrations.
- UI consumers: checkout and Operations slot pagination handling.
- Tests: payment unit/integration/E2E, unpaid completion, pagination,
  observability, rate-limiter adapter, updated checkout/Operations fixtures.
- Tooling/docs: package overrides, production audit script, CI, README, API and
  state-machine docs.

## Remaining Staging Checks and Risks

- Run `git status`, `git log`, secret-history scanning, and review the exact diff
  in the real Git-backed checkout. This cannot be reconstructed here.
- Configure a shared production/staging `RateLimiter` adapter before running
  more than one application instance.
- Connect the structured logger to the approved staging sink and retention
  policy; the current default writes JSON lines to stdout.
- Confirm payment dual-approval/refund policy with the business owner. The new
  `REFUNDED` state is schema-ready but no refund action is intentionally exposed.
- Local image/evidence storage remains development/test-only.
- Prisma 7 migration of deprecated package configuration remains low-priority
  maintenance and does not block the current Prisma 6 staging candidate.

### Pre-existing local fixture residue

A read-only post-E2E check found no Operations fixture namespace created by the
2026-07-15 run and no local evidence directory. Six older namespaces remain
from 2026-07-13/14; they were deliberately not deleted automatically:

```powershell
pnpm cleanup:operations-fixtures -- ops236add70801040dda2c9d913338b3605 ops8245ceef4c31478691bcabba617477e5 ops70bed400da3a4f67bee9bac2eef8508b opsdffd9edc540849ef8dc85865fc617f0f ops2a81e02b7fa54f79a0f4a7ecd509bd40 ops7d1d561ed378424fbb61f1414f79a4a1
```

This command is namespace-scoped and repeatable. A human may run it when the
old local test data is no longer needed.
