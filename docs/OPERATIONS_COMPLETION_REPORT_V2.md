# Operations Completion Review V2

Review date: 2026-07-14 (Asia/Bangkok)

## Scope and evidence

This is an independent remediation review of the current workspace after the
second remediation. It reviewed the prior report, Operations migrations,
state-machine and service code, fixtures, integration tests, E2E tests, and
the current package scripts.

The workspace has no `.git` directory. `git status` and `git log` therefore
cannot inspect a branch, commits, or a diff. This review is based on all
current files available in the workspace; it does not make claims about
unavailable Git history.

## Decision

**OPERATIONS DONE**

There are no Critical or High findings in this review. H-01 through H-04 and
M-01 through M-06 are fixed, have regression coverage, and the required gates
below passed after the final `pnpm db:migrate`. The full Playwright suite passed
freshly with 13 tests and no retry reported.

## Remediation matrix

| Finding | Status | Implementation evidence | Regression evidence | Fresh verification |
|---|---|---|---|---|
| H-01 Lost update in admin order transition | **FIXED** | `src/modules/commerce/application/commerce-service.ts` uses a transaction, locks the order, and requires a conditional `order.updateMany` on `id`, `version`, `status`, and `inventoryStatus`; `count !== 1` is a conflict. | `tests/integration/order-transitions.test.ts` - `allows only one concurrent confirm for the same expected version`. | `pnpm test:integration` PASS (6 files, 38 tests). |
| H-02 Order policy, inventory side effects, audit atomicity | **FIXED** | `src/modules/commerce/domain/order-transition.ts` is the centralized policy. `commerce-service.ts` consumes reserved inventory and writes order plus audit in one transaction. | `tests/unit/order-transition.test.ts`; `tests/integration/order-transitions.test.ts` tests consume-once, missing reservation rollback, rejected inventory write rollback, payment, stale version, and invalid states. | `pnpm test` PASS (11 files, 38 tests); `pnpm test:integration` PASS. |
| H-03 Unsafe progressed-assignment migration | **FIXED** | `prisma/migrations/20260714110000_operations_assignment_timestamp_forward_fix/migration.sql` is a forward-only corrective migration: it detects contradictory history, backfills the earliest trustworthy `assigned_at`, adds legacy `arrived_at`, then validates the constraint. `docs/OPERATIONS_MIGRATION_RUNBOOK.md` documents recovery. | `scripts/test-operations-migration-upgrade.ts` with `tests/migration/*.sql` replays the pre-integrity schema for progressed states and asserts invalid history rollback. | `pnpm test:migration` PASS: valid upgrade and invalid-history rejection/rollback. |
| H-04 Unstable required E2E fixtures/page selection | **FIXED** | `tests/e2e/operations.helpers.ts` uses response-aware cursor navigation and failure-safe fixture cleanup; tests use independent namespaced fixtures from `tests/fixtures/operations.ts`. | `tests/e2e/operations-assignment.spec.ts`, `operations-reschedule.spec.ts`, `operations-staff-ui.spec.ts`, and `operations-technician-workflow.spec.ts`. | `pnpm test:e2e` PASS (13/13). |
| M-01 Failure-unsafe fixture cleanup | **FIXED** | `tests/fixtures/operations.ts` provides `runFailureSafeCleanup` and `cleanupOperationsFixtureNamespace`, which validates the namespace and independently cleans records and evidence. `tests/e2e/operations.helpers.ts` aggregates test and cleanup failures. | `tests/integration/operations.test.ts` - `cleans database rows and evidence after a browser close cleanup failure`. | `pnpm test:integration` PASS. |
| M-02 Unbounded candidate-technician list | **FIXED** | `src/modules/operations/application/operations-service.ts` bounds candidates to 1-100 (default contract 25), uses stable name/id ordering, cursor pagination, area/active/conflict filtering. `src/modules/operations/presentation/schemas.ts` and `src/components/operations/operations-console.tsx` expose pagination/search. | `tests/unit/operations-schemas.test.ts`; `tests/integration/operations.test.ts` - suitable-candidate and pagination cases; manager E2E checks filtered choices. | Unit, integration, and E2E suites PASS. |
| M-03 Missing centralized mutation security contract | **FIXED** | `src/shared/http/api-handler.ts` enforces allowed origin, JSON content type, body cap, and rate limiting before Operations mutations. Mutation routes use `withOperationsJsonMutation`; error responses are structured. | `tests/unit/api-handler.test.ts` covers rejected origin, content type, oversized body, and rate limit. | `pnpm test` PASS; Operations E2E PASS with local test origin. |
| M-04 Missing application-level concurrency coverage | **FIXED** | Conditional version/state writes exist in `commerce-service.ts` and `src/modules/operations/application/operations-service.ts`; PostgreSQL exclusion violations are normalized to conflict at the application boundary. | `tests/integration/order-transitions.test.ts` concurrent confirm; `tests/integration/operations.test.ts` concurrent assignment and concurrent technician action; `operations-technician-workflow.spec.ts` sends two concurrent EN_ROUTE requests. | `pnpm test:integration` PASS; `pnpm test:e2e` PASS. |
| M-05 Missing no-store headers on authenticated Operations data | **FIXED** | Operations list/detail route handlers use `Cache-Control: private, no-store`; common response helper supports the same contract. | `tests/e2e/operations-cache-headers.spec.ts`. | `pnpm test:e2e` PASS. |
| M-06 Unsafe money conversion for display | **FIXED** | `src/shared/money/format-vnd.ts` formats integer `string` or `bigint` without JavaScript `Number`; `src/components/operations/operations-console.tsx` uses it. | `tests/unit/format-vnd.test.ts` covers values above `Number.MAX_SAFE_INTEGER`. | `pnpm test` PASS. |

## Required commands run on the current repository

| Command | Result |
|---|---|
| `pnpm db:migrate` | PASS. PostgreSQL `home247` on `localhost:5433`; 8 migrations found; no pending migration. |
| `pnpm lint` | PASS. |
| `pnpm typecheck` | PASS. |
| `pnpm test` | PASS. 11 files, 38 tests. |
| `pnpm test:integration` | PASS. 6 files, 38 tests on PostgreSQL. |
| `pnpm test:migration` | PASS. Valid progressed-assignment upgrade and invalid-history rollback both passed. |
| `pnpm test:e2e` | PASS. 13/13 Chromium tests, fresh after the migration command. |
| `pnpm build` | PASS. Next.js production build completed. |

## Findings after review

### Critical

None.

### High

None.

### Medium

None. All prior Medium findings M-01 through M-06 are fixed; no human risk
acceptance is required to classify this Operations slice as done.

### Low / follow-up

1. The Operations rate limiter in
   `src/modules/identity/infrastructure/rate-limiter.ts` is in-memory and
   process-local. It is adequate for local/single-instance behavior tested
   here, but a multi-instance deployment needs an approved shared store.
2. `docs/API_CONTRACT.md` describes cursors generically as opaque while the
   Operations implementation currently returns the last record ID. This is a
   contract clarity issue, not a paging correctness failure under the tested
   routes.
3. The fresh E2E run emitted a Next.js warning that an evidence image changes
   only one dimension. The workflow and preview passed; visual aspect-ratio
   polish should be checked before release.
4. Git history could not be inspected because this workspace has no `.git`
   metadata. Preserve a Git-backed review artifact for future change audits.

## Manual verification still useful

1. Rehearse the H-03 runbook on a production-sized staging snapshot, including
   lock duration, backup restore, and the post-migration constraint queries.
2. Verify keyboard focus and screen-reader announcements in assignment and
   reschedule confirmation dialogs at desktop and narrow mobile widths.
3. For a multi-instance deployment, replace the process-local rate limiter
   with an approved shared implementation before exposing Operations mutations.

## Database and rollback notes

No reset, drop, truncate, or production operation was run. The H-03 migration
is forward-only. On a validation failure its explicit transaction rolls back;
do not remove assignments, timestamps, enum values, or migration history.
Use the documented audited forward-fix procedure in
`docs/OPERATIONS_MIGRATION_RUNBOOK.md` for legacy or partially applied states.
