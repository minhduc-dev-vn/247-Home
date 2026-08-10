# Current System Audit Report

**Project:** 247 Home
**Audit date:** 2026-07-28
**Audited revision:** `3346797` on `feature/auto-update`
**Audit mode:** source, configuration, migration, test-gate, and deployment-readiness review
**Scope:** Customer, Admin, Technician, Warranty, Orders, Payments, Operations, assets, Docker, CI, Prisma, infrastructure, tests, and documentation.

## 1. Executive Summary

**Market/release verdict: NOT READY.**

The repository contains substantial application functionality, but it is in the middle of remediation and cannot yet be treated as a verified public release. Two critical defects affect customer recovery and inventory integrity. Six high-risk deployment, availability, payment, media, and credential-management issues remain. The current Render instance cannot be certified from this checkout because its deployed branch, revision, environment, database connectivity, and logs were not available to the audit.

The recent customer-registration failure cannot be attributed to one live cause from the browser message alone. The source review identifies three credible production paths:

1. Render may be deploying `main`, while the registration remediation and role-reference migration exist only on `feature/auto-update`.
2. The application can be marked healthy by Render while PostgreSQL is unavailable, because the configured `/api/health` endpoint is liveness-only.
3. Registration accepts only configured origins. A mismatch between the public Render/custom-domain URL and `NEXTAUTH_URL`/`APP_ORIGIN` returns a server-side rejection.

The immediate action is to determine the actual Render deployment revision, rotate the database credential that was exposed during support, and collect a request ID plus Render application log for one failed registration attempt. Do not treat a successful build or a green historical GitHub Actions run as proof that the public deployment is operating correctly.

## 2. Audit Method and Boundaries

- Inventoried the repository's application, source, test, documentation, Prisma, Docker, CI, Terraform, and public-asset trees.
- Reviewed the runtime paths for identity, product media, checkout/inventory, payments, Operations, Warranty, health/readiness, and Render deployment configuration.
- Reviewed all migration directories and the recent branch history relevant to registration, payment, and identity role data.
- Ran the local commands listed in section 10 without contacting an external database or deploying infrastructure.
- Did not reset, truncate, seed, migrate, or otherwise alter any database. Docker Desktop was unavailable, so PostgreSQL-dependent verification could not run.
- Did not inspect secret values. A secret-pattern scan of tracked files did not find AWS access keys or private-key material.

This is a repository audit. It does not prove the state of Render, DNS, Cloudflare, VNPay, or any managed database without their redacted runtime evidence.

## 3. Repository and Deployment Snapshot

| Item | Observed state | Risk / implication |
| --- | --- | --- |
| Current branch | `feature/auto-update` at `3346797` | Local fixes and uncommitted work are not necessarily deployed. |
| Divergence from `main` | Feature is 11 commits ahead; `main` is 3 commits ahead | Deployment branch selection must be made explicit. |
| Identity role migration | Present on feature: `prisma/migrations/20260726120000_identity_role_reference_data` | Missing from `main`; a deployment of `main` can lack role reference rows needed by registration. |
| Payment migration | Present on feature: `20260722120000_online_payment_vnpay` | Missing from `main`; branch drift is not release-safe. |
| Render configuration | No `render.yaml` in the repository | The active Render branch, build command, health endpoint, and environment cannot be reviewed as code. |
| Local database | `127.0.0.1:5433` was unreachable | Integration, migration-upgrade, and live E2E validation are currently blocked. |
| Docker daemon | Not available | Local PostgreSQL and migration test container could not start. |
| Working tree | 21 modified tracked files and 5 untracked files before this audit report | The current checkout is an in-progress state, not a reproducible release revision. |

### Main vs feature deployment risk

`main` does not contain the current feature branch's registration self-healing behavior or its identity-role reference-data migration. In particular, its older registration path can fail when the `CUSTOMER` role row is absent. The feature branch includes a forward migration which inserts all role reference data idempotently. Therefore a Render service tracking `main` can continue showing the historical registration failure even though a fix exists locally on `feature/auto-update`.

**Required evidence before further debugging:** from Render, record the service's selected branch and deployed commit SHA, plus a redeploy log. The target SHA must match the reviewed release commit, not merely a local checkout.

## 4. Test and Quality-Gate Evidence

| Command | Result | Evidence / limitation |
| --- | --- | --- |
| `pnpm lint` | PASS | Completed in current worktree. |
| `pnpm typecheck` | PASS | Completed in current worktree. |
| `pnpm audit:prod` | PASS | 180 production packages; no moderate-or-higher advisory reported. |
| `pnpm test` | PASS | 36 files, 182 tests. |
| `pnpm format:check` | FAIL | Prettier reported style issues in 77 files. |
| `pnpm test:integration` | BLOCKED / FAIL | 11 files: 62 failed, 25 skipped, all due to PostgreSQL connection failure at local `127.0.0.1:5433`; no application assertion failure was established. |
| `pnpm test:migration` | BLOCKED / FAIL | Could not start the required ephemeral PostgreSQL Docker container because Docker Desktop was unavailable. |
| `pnpm exec prisma migrate status` | BLOCKED / FAIL | Prisma could not reach the local datasource. It also emitted a Prisma 7 deprecation warning for `package.json#prisma`. |
| `pnpm test:e2e -- --list` | PASS (discovery only) | 48 tests in 22 files were discovered. Full browser execution was not run because the database prerequisite was unavailable. |
| `pnpm build` | PASS | Next.js `16.2.11` build completed with 32 static pages. |
| `terraform fmt -check ...` | BLOCKED | Terraform CLI is not installed in this environment. |
| `git diff --check` | PASS | No whitespace errors; Windows CRLF warnings were emitted. |

GitHub Actions runs for committed revision `3346797` were green, but that evidence applies only to the committed revision. It does not validate the present dirty worktree or the live Render service.

## 5. Detailed Findings

### Critical

#### C-01 - Password-reset production failure leaks whether an email exists

**Evidence**

- [`src/modules/identity/infrastructure/local-password-reset-mailer.ts`](../src/modules/identity/infrastructure/local-password-reset-mailer.ts) throws when `NODE_ENV` is `production`.
- [`src/modules/identity/application/identity-service.ts`](../src/modules/identity/application/identity-service.ts) returns successfully for unknown or inactive users, but creates a reset token and invokes the mailer for a known active user.
- [`app/api/v1/auth/forgot-password/route.ts`](../app/api/v1/auth/forgot-password/route.ts) returns HTTP 500 when mail delivery throws.

**Impact**

An attacker can distinguish an existing account from an unknown account by comparing the response. Legitimate customers cannot reset a password in production, and a reset token can remain persisted even though delivery failed.

**Required remediation**

Implement a production mail/outbox adapter, return the same accepted response for all email addresses, and make token persistence/delivery failure handling explicit and transactional. Add a production-mode regression test for existing and unknown email addresses.

#### C-02 - Inventory and appointment capacity have no cancellation/release lifecycle

**Evidence**

- [`src/modules/commerce/domain/order-transition.ts`](../src/modules/commerce/domain/order-transition.ts) permits confirmation, processing, ready-for-installation, and completion actions only; it has no cancellation/expiration transition or `RELEASE_RESERVED` inventory effect.
- [`src/modules/commerce/application/commerce-service.ts`](../src/modules/commerce/application/commerce-service.ts) reserves inventory and increments appointment-slot capacity during checkout.
- No production application write path was found that changes `InventoryDisposition` to `RELEASED` or releases a booked installation slot after a failed/abandoned payment.

**Impact**

Abandoned checkout and failed online payment flows can permanently reserve stock and installation capacity. This can cause apparent out-of-stock conditions and slot exhaustion without completed orders.

**Required remediation**

Introduce a server-side cancel/expire policy, execute stock/slot release and audit logging in one transaction, and operate a scheduled expiry process. Add PostgreSQL integration tests for failed payment, cancellation, retry, and idempotent release.

### High

#### H-01 - Release branch and Render revision are not controlled as code

**Evidence**

- `feature/auto-update` is 11 commits ahead of `main`; `main` is 3 commits ahead.
- `main` lacks `20260722120000_online_payment_vnpay`, `20260726120000_identity_role_reference_data`, and the current registration remediation.
- No `render.yaml` or equivalent deployment blueprint was found.

**Impact**

The service can deploy a branch that does not contain the intended migrations or runtime fixes. This is a leading explanation for a public registration error persisting after a local change.

**Required remediation**

Choose one protected release branch, merge/rebase intentionally, commit all reviewed changes, set Render to that branch, and record the deployed SHA. Add a Render blueprint or an equivalent version-controlled deployment manifest where supported.

#### H-02 - Render health check can report healthy while PostgreSQL is down

**Evidence**

- [`docs/RENDER_STAGING_RUNBOOK.md`](RENDER_STAGING_RUNBOOK.md) instructs Render to use `/api/health`.
- [`app/api/health/route.ts`](../app/api/health/route.ts) is liveness-only and does not check PostgreSQL.
- [`app/api/ready/route.ts`](../app/api/ready/route.ts) performs a database reachability check and returns 503 when unavailable.
- Docker Compose correctly uses `/api/ready`, creating a mismatch with the Render runbook.

**Impact**

Render can keep routing traffic to an application where registration, login, catalog, and order operations fail due to database connectivity.

**Required remediation**

Configure Render's health check as `/api/ready`, validate it using the exact public origin, and alert on 503. Keep `/api/health` only for process liveness if desired.

#### H-03 - A customer can create multiple active VNPay payment sessions for one order

**Evidence**

- [`src/modules/payment/domain/payment-lifecycle.ts`](../src/modules/payment/domain/payment-lifecycle.ts) permits a new payment session while payment status is `PROCESSING`.
- [`src/modules/payment/application/payment-service.ts`](../src/modules/payment/application/payment-service.ts) scopes idempotency to payment plus idempotency key. A new key can create another pending session without first expiring or rejecting an existing active one.

**Impact**

An order can receive multiple gateway links and potentially multiple provider charges. A later callback may be treated as a local duplicate after the first payment is paid, without a defined refund/reconciliation response.

**Required remediation**

Allow exactly one unexpired active provider session per payment, expire/reject it before a replacement session, and reconcile a second provider transaction explicitly. Validate this in VNPay sandbox before enabling online payment publicly.

#### H-04 - Rate-limit enforcement depends on unverified ingress policy

**Evidence**

- [`src/modules/identity/infrastructure/rate-limiter.ts`](../src/modules/identity/infrastructure/rate-limiter.ts) uses a WAF-delegated limiter which permits requests in application code; real enforcement is expected upstream.
- P0 evidence documents show the AWS/WAF staging validation was not executed or approved.
- [`src/shared/http/client-address.ts`](../src/shared/http/client-address.ts) trusts forwarded-client-address headers in certain Render configurations; without hosting-provider proof that headers are overwritten/stripped, client identity cannot be fully trusted.

**Impact**

Public authentication/mutation protection may be ineffective under multi-instance deployment, and client-address spoofing or shared-bucket throttling can occur depending on ingress settings.

**Required remediation**

For the actual hosting topology, prove a shared limiter is enforced with a controlled 429 probe, document trusted-proxy behavior, and retain evidence. Until then, treat public rate-limit claims as unverified.

#### H-05 - Database-backed product images are unavailable in production

**Evidence**

- [`src/modules/catalog/infrastructure/local-image-storage.ts`](../src/modules/catalog/infrastructure/local-image-storage.ts) disables local storage outside development/test.
- [`app/api/v1/product-images/[id]/route.ts`](../app/api/v1/product-images/[id]/route.ts) reads from that local adapter.
- Product cards and galleries prefer persisted `ProductImage` URLs when a database image record exists, so they bypass the static fallback under `public/assets/images/products/`.

**Impact**

Admin-uploaded catalog images will return unavailable responses in production. The product image symptom shown in the public site is consistent with a missing/deployed-static-asset or media-backend problem, but the exact Render cause cannot be proven without response headers and deployed revision evidence.

**Required remediation**

Use an S3-compatible production media adapter, preserve authorization and MIME/size controls, and migrate/verify existing image records. Separately verify that the deployed Docker/Render artifact contains the tracked `public` assets.

#### H-06 - An external database credential was exposed during support

**Evidence**

A live external database connection string was provided in the support conversation. It was not repeated in this report and was not found in tracked repository files.

**Impact**

Anyone with that value may be able to connect to the database, depending on network and provider controls.

**Required remediation**

Rotate the database password/connection secret immediately, update Render only through its secret environment settings, invalidate old connections if supported, and review provider connection/audit logs. Never paste credentials into issues, chat, commit messages, docs, or screenshots.

### Medium

#### M-01 - Full integration, migration, and E2E gates are not currently verified

The local database and Docker daemon were unavailable. The 62 reported integration failures are connection failures, not evidence that 62 product assertions are broken. Nevertheless, no fresh full E2E or migration-upgrade result exists for the current worktree. This blocks a release claim.

#### M-02 - Formatting gate is red and CI does not enforce it

`pnpm format:check` reports 77 files needing formatting. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) does not run this script. This allows a green CI run while the repository's configured formatting gate fails.

#### M-03 - Documentation is stale or internally contradictory

- [`README.md`](../README.md) still states that customer Warranty APIs/mutations are deferred, while their routes and modules are present.
- [`THREAT_MODEL.md`](THREAT_MODEL.md) lists payment/cloud-related scope as excluded despite VNPay and infrastructure code being present.
- Several historical reports refer to older migration and E2E counts (11 migrations / 47 E2E tests); the current tree has 16 migrations and discovers 48 E2E tests.

Historical reports should be retained, but each must identify its reviewed commit and date. A current canonical status document is needed.

#### M-04 - Product/catalog visibility depends on an explicit seed/deployment step

`prisma migrate deploy` applies schema only; it does not seed products. [`prisma/seed.ts`](../prisma/seed.ts) contains demo catalog data, but Render has no reviewed predeploy/seed procedure in code. An empty catalog after migrations alone is therefore expected. Production seeding must be explicitly approved and targeted; never use reset/truncate on a live database.

#### M-05 - Reset-password unexpected errors are not correlated with request diagnostics

[`app/api/v1/auth/reset-password/route.ts`](../app/api/v1/auth/reset-password/route.ts) catches unexpected failures and returns a generic 500 without forwarding the error through the shared application-error logger. This makes production diagnosis harder even though other routes now log unexpected failures.

#### M-06 - VNPay IPN response and throttling behavior require sandbox verification

[`app/api/v1/payment/webhook/route.ts`](../app/api/v1/payment/webhook/route.ts) relies on general mutation handling/rate-limit behavior and generic error envelopes. The gateway's exact expected `{ RspCode, Message }` failure contract, signature failure handling, retries, and reconciliation have not been demonstrated in a real sandbox transaction.

#### M-07 - Prisma configuration will need migration before Prisma 7

Prisma warns that `package.json#prisma` is deprecated. This is not the current registration failure, but it is a predictable maintenance failure if the dependency is upgraded without a `prisma.config.ts` migration.

## 6. Module Completion Status

| Module | Status | Audit assessment |
| --- | --- | --- |
| Identity and Access | PARTIAL | Registration improvements exist on the feature branch, but production/reset behavior and release provenance are unresolved. |
| Catalog and Inventory | PARTIAL | Catalog/stock data model and static assets exist; production image persistence is not complete and live catalog seed state is unverified. |
| Cart, Checkout, Orders | PARTIAL | Server-side pricing/reservation logic exists; cancellation/expiry release lifecycle is missing. |
| Payments | PARTIAL / BLOCKED | VNPay code and tests exist, but duplicate active-session guard and sandbox/IPN verification are incomplete. |
| Operations | FUNCTIONALLY PRESENT, NOT RE-VERIFIED | State machine, assignment, evidence, and audit surfaces exist; PostgreSQL integration/E2E validation is blocked locally. |
| Technician Portal | FUNCTIONALLY PRESENT, NOT RE-VERIFIED | Role-scoped routes and workflow UI exist; fresh database-backed E2E execution is pending. |
| Customer Warranty | FUNCTIONALLY PRESENT, NOT RE-VERIFIED | Owner-scoped routes/UI are present; fresh integration/E2E evidence is pending. |
| Evidence / File Storage | PARTIAL | Local mock storage works in development; a production object-storage adapter is required for persisted catalog media and must be verified for evidence. |
| UI / Responsive design | PARTIAL | Design-system and role-specific layouts exist; static code/E2E discovery are present, but current browser/device validation is not complete. |
| Local demo / Docker | BLOCKED | Docker daemon and local database were not running during audit. |
| Render / infrastructure | BLOCKED | No live revision, health, secret, backup, TLS, rate-limit, or rollback evidence was available. |

## 7. Current In-Progress Changes That Need Controlled Review

The checkout is not clean. Among the uncommitted changes are registration error handling, password-policy/UI changes, health response details, query-schema handling, integration/unit tests, and user-facing pages. The password minimum is being changed from 12 to 8 characters in the working tree.

These changes passed lint, typecheck, and unit tests in this checkout, but they have **not** passed fresh PostgreSQL integration or full E2E gates. The password-length change is a policy decision and is not, by itself, a root-cause fix for the production registration error. Review, format, test, commit, and deploy it only as a deliberate release unit.

## 8. Registration and Product-Image Incident Analysis

### Registration error

The customer-facing generic message is intentionally non-enumerating, so it cannot identify the server cause. Use this sequence for one controlled failed request:

1. In the browser developer tools, capture the request URL, response status, response body, and returned request ID; redact tokens/cookies.
2. In Render logs, search that request ID and record the exception class/message without secret values.
3. Confirm the deployed SHA and compare it with the release commit containing the intended identity migration/fix.
4. Confirm the database is reachable with `/api/ready`, not only `/api/health`.
5. Verify the configured public canonical URL exactly matches `NEXTAUTH_URL` and `APP_ORIGIN`; inspect an origin rejection before changing code.
6. Check that `CUSTOMER` role reference data exists through a controlled, read-only database query or Prisma Studio tunnel. Do not manually insert roles until the deployed migration state is known.

### Missing images

Tracked static product images are present under `public/assets/images/products/`, so a missing static image in the public deployment is not explained by a missing local file. Verify the public image URL directly and record HTTP status, `Content-Type`, `Cache-Control`, and deployed SHA. If a database image record is being used, the current production local-image adapter is an independent confirmed defect and requires object storage.

## 9. Required Remediation Order

### P0 - before any public promotion

1. Rotate the exposed external database credential and update only secret stores.
2. Freeze an explicit release branch and make Render deploy that branch; record deployed SHA and migration status.
3. Point Render health monitoring to `/api/ready` and verify a database outage yields 503.
4. Fix password-reset production delivery and equalize known/unknown-account response behavior.
5. Implement and test transactional order cancellation/expiry to release inventory and appointment capacity.
6. Disable or restrict online payment until a single active payment-session invariant, signed IPN behavior, and sandbox reconciliation are verified.

### P1 - before production hardening sign-off

1. Replace production local image storage with an S3-compatible adapter and migrate/verify media.
2. Prove shared rate-limit enforcement at the actual ingress with a documented 429 probe.
3. Start local PostgreSQL/Docker, run migrations safely, then run full integration, migration, and E2E gates from a clean checkout.
4. Format the repository and add `format:check` to CI.
5. Reconcile README, threat model, runbooks, and status reports with the reviewed release SHA.

## 10. Commands Executed During This Audit

```powershell
pnpm lint
pnpm typecheck
pnpm audit:prod
pnpm test
pnpm format:check
pnpm test:integration
pnpm test:migration
pnpm exec prisma migrate status
pnpm test:e2e -- --list
pnpm build
docker compose ps
docker version
terraform version
terraform fmt -check ...
git diff --check
git status --short
```

Commands that require PostgreSQL or Docker were not retried with database reset, drop, truncate, or external-database access. No secrets are included in this report.

## 11. Evidence Still Required for a Release Decision

- Render service settings showing selected branch, deployed commit SHA, health endpoint, and environment-key names only.
- Redacted application log correlated to a failed registration request ID.
- `/api/ready` response from the deployed service and a deliberate database-unavailable test in staging.
- Fresh `db:migrate`, seed policy/result, integration, migration-upgrade, and full E2E output after the final release commit.
- Evidence that demo/production catalog records and media URLs are present without destructive database operations.
- VNPay sandbox transaction, signed callback/IPN verification, and reconciliation record.
- Backup/restore, rollback, HTTPS, object-storage lifecycle, and rate-limit enforcement evidence for the actual staging provider.

## 12. Final Conclusion

**CURRENT SYSTEM AUDIT COMPLETE - RELEASE NOT READY.**

The codebase is not an empty prototype; it contains the major customer, operations, technician, warranty, and payment surfaces. However, deployment provenance, database readiness, password reset behavior, inventory release semantics, payment-session safety, production media storage, and external-secret handling must be resolved and independently verified before a production or public-market readiness claim is made.
