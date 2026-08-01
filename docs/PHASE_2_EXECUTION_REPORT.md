# Phase 2 Execution Report

- **Plan:** [`CURRENT_SYSTEM_REMEDIATION_PLAN.md`](CURRENT_SYSTEM_REMEDIATION_PLAN.md)
- **Executed:** 2026-07-28
- **Scope:** Phase 2 - registration and password-recovery reliability

## Status

**PHASE 2 REPOSITORY REMEDIATION COMPLETE.** The tested repository now has a
transactional, fail-closed password-reset delivery outbox and a race-safe
customer role lookup. This is not a claim that a real mail provider or Render
staging has been configured; those owner-controlled steps remain below.

## Requirement Matrix

| Requirement | Implementation | Regression evidence | Status |
| --- | --- | --- | --- |
| Missing `CUSTOMER` reference role does not make registration fail | `src/modules/identity/infrastructure/user-repository.ts` uses PostgreSQL `upsert` in the same user transaction | `tests/integration/identity-role-reference.test.ts` starts a PostgreSQL database before the role-reference migration and proves self-heal plus idempotent migration | PASS |
| Duplicate registration and bad origin use safe HTTP responses | `app/api/v1/auth/register/route.ts`, existing shared mutation handler | `tests/integration/identity.test.ts` | PASS |
| Valid known, unknown and inactive reset requests do not expose account state | `identity-service.ts` applies bcrypt timing padding; forgot route always returns accepted after valid parsing | `tests/integration/identity.test.ts`; `tests/unit/password-reset-routes.test.ts` | PASS |
| Token and delivery record are atomic | `identity-service.ts`, Prisma nested delivery create, migration `20260728120000_identity_password_reset_outbox` | PostgreSQL integration tests and migration upgrade test | PASS |
| Undelivered token cannot reset password | `resetPassword` requires delivery status `DELIVERED` | delivery success/failure and token replay tests in `tests/integration/identity.test.ts` | PASS |
| Delivery retries are claimed only once | `password-reset-delivery-service.ts` uses conditional status/lease/processing token updates | PostgreSQL concurrent delivery test in `tests/integration/identity.test.ts` | PASS |
| Raw reset token is not stored in plaintext or application logs | `password-reset-outbox-crypto.ts`, safe logger calls in auth routes | `tests/unit/password-reset-outbox.test.ts`, `tests/unit/password-reset-routes.test.ts` | PASS |
| Browser password recovery works after queued delivery | `tests/e2e/password-recovery.spec.ts` | Full Playwright run, 49/49 | PASS |
| Production mail adapter does not rely on local filesystem mailer | `password-reset-mailer.ts`, `scripts/deliver-password-reset-outbox.ts`, ADR-002 | unit configuration tests and local worker smoke | PASS (repository) |

## Database Change

Migration: `20260728120000_identity_password_reset_outbox`

- Adds `PasswordResetDeliveryStatus` and `password_reset_deliveries`.
- Links one delivery row to one reset token, with a worker index and attempt
  constraint.
- Does not delete, update or backfill existing reset-token rows.
- Old pre-outbox links fail closed because they have no confirmed delivery row;
  users must request a new link.
- Forward-fix only: do not drop the enum/table or downgrade to the old reset
  implementation. Disable recovery temporarily and forward-fix application code
  if an emergency rollback is required.

Migration upgrade evidence is provided by:

- `tests/migration/password-reset-outbox-upgrade-assertions.sql`
- `scripts/test-password-reset-outbox-migration-upgrade.ts`
- canonical `pnpm test:migration`

## Commands and Results

| Command | Result |
| --- | --- |
| `pnpm db:generate` | PASS |
| `pnpm db:migrate` | PASS - 17 migrations, no pending migration |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS - 38 files, 187 tests |
| `pnpm test:integration` | PASS - 12 files, 93 PostgreSQL-backed tests |
| `pnpm test:migration` | PASS - Operations/address upgrade tests and password-reset outbox legacy-token upgrade test |
| `pnpm test:e2e` | PASS - 49 Playwright tests on a fresh source server |
| `pnpm build` | PASS |
| `pnpm password-reset:deliver -- --limit 1` | PASS - worker booted, no pending row to process |
| Docker `/api/ready` smoke | PASS - HTTP 200 after restoring local app container |

The first migration attempt found Docker Desktop stopped; no database write was
performed then. Docker was started, PostgreSQL became healthy, and the final
`pnpm db:migrate` applied the additive migration successfully.

## Files Added or Changed

- `prisma/schema.prisma`
- `prisma/migrations/20260728120000_identity_password_reset_outbox/migration.sql`
- `src/modules/identity/application/identity-service.ts`
- `src/modules/identity/application/password-reset-delivery-service.ts`
- `src/modules/identity/infrastructure/password-reset-outbox-crypto.ts`
- `src/modules/identity/infrastructure/password-reset-mailer.ts`
- `src/modules/identity/infrastructure/local-password-reset-mailer.ts`
- `src/modules/identity/infrastructure/user-repository.ts`
- `app/api/v1/auth/forgot-password/route.ts`
- `app/api/v1/auth/reset-password/route.ts`
- `scripts/deliver-password-reset-outbox.ts`
- `scripts/test-migration-upgrades.ts`
- `scripts/test-password-reset-outbox-migration-upgrade.ts`
- `tests/unit/password-reset-outbox.test.ts`
- `tests/unit/password-reset-routes.test.ts`
- `tests/integration/identity.test.ts`
- `tests/integration/identity-role-reference.test.ts`
- `tests/e2e/password-recovery.spec.ts`
- `tests/migration/password-reset-outbox-upgrade-assertions.sql`
- `.env.example`, `package.json`, `playwright.config.ts`, identity/API/runbook/ADR
  documentation and `README.md`

## Remaining External Actions

1. The Render owner must configure the deployed revision, `/api/ready`, and the
   exact public origin values, then reproduce registration once using a request
   ID if any deployment-only error remains.
2. Before enabling production password recovery, the owner must create a Resend
   API key and verified sender, store `RESEND_API_KEY` and `PASSWORD_RESET_FROM`
   only in the deployment secret manager, set `PASSWORD_RESET_MAILER=resend`,
   and schedule `pnpm password-reset:deliver -- --limit 20` with alerting on a
   non-zero exit. No provider credential was created, used or committed here.
3. The previously exposed external database credential must still be rotated by
   its owner. This work did not connect to, migrate or seed an external database.

## Residual Risks

- Resend acceptance is tested through the adapter contract, not a live provider
  account. A staged synthetic delivery is mandatory before public recovery is
  enabled.
- An Auth.js secret rotation intentionally makes pending encrypted delivery
  payloads unusable; follow the incident runbook and have users request a new
  link.
- Full E2E emitted existing Next.js LCP image-loading warnings but all tests
  passed. The warnings are performance follow-up work outside Phase 2.
- Unrelated pagination/query worktree changes remain uncommitted and were not
  included in this Phase 2 remediation.
