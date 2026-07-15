# 247 Home Project Audit Report

Audit date: 2026-07-14, Asia/Bangkok

## 1. Executive Summary

This is an independent whole-repository audit of the current workspace. I read
`AGENTS.md`, `README.md`, all files under `docs/`, `package.json`,
`prisma/schema.prisma`, all Prisma migration SQL/rollback notes, GitHub Actions,
test configuration, environment configuration, and the Operations completion
reports. No application code, migrations, dependencies, deployment settings, or
database data were changed.

Decision: **PROJECT BLOCKED**.

Reason: the full required gates cannot pass in the current environment because
Docker Desktop / the Linux Docker engine is unavailable, so PostgreSQL-dependent
migration, integration, migration-upgrade, and E2E gates failed freshly. In
addition, the source review found High findings in non-Operations mutation
security and order/payment business integrity.

Operations-specific invariants from `docs/OPERATIONS_COMPLETION_REPORT_V2.md`
remain supported by source evidence: ARRIVED exists as a distinct state,
Operations mutations use the centralized mutation wrapper, candidate technicians
are bounded/paginated, assignment/reschedule use PostgreSQL constraints and
transactions, technician ownership is enforced, evidence preview is authorized,
and Operations E2E tests still exist. I did not weaken or rewrite Operations.

Finding counts: Critical 0, High 4, Medium 6, Low 3.

## 2. Commands And Actual Results

| Command | Result |
|---|---|
| `git status --short --branch` | FAIL. `fatal: not a git repository`. |
| `git log --oneline -10` | FAIL. `fatal: not a git repository`. |
| `pnpm db:up` | FAIL. Docker API pipe `dockerDesktopLinuxEngine` not found. |
| `pnpm db:migrate` | FAIL. Prisma could not reach PostgreSQL at `localhost:5433`. |
| `pnpm lint` | PASS. |
| `pnpm typecheck` | PASS. |
| `pnpm test` | PASS. 11 files, 38 tests. |
| `pnpm test:integration` | FAIL. 6 files failed because PostgreSQL at `localhost:5433` was unreachable. |
| `pnpm test:migration` | FAIL. Migration harness could not start Docker container. |
| `pnpm test:e2e` | FAIL. 2 passed, 11 failed; failures root in missing DB/seed/session plus fixture DB connection errors. |
| `pnpm build` | PASS. Next.js production build completed. |
| `pnpm audit --prod` | FAIL. 2 moderate advisories: transitive `postcss` via `next`, transitive `uuid` via `next-auth`. |

No prior gate result was reused.

## 3. Critical Findings

None confirmed.

## 4. High Findings

### ENV-H-01 - Required DB-dependent gates cannot run

Severity: High. Type: Execution blocker / missing evidence.

Files and lines:
- `docker-compose.yml:1` defines PostgreSQL service.
- `package.json:18-26` defines required DB/test scripts.
- `playwright.config.ts:21-29` relies on a local dev server and fixture DB.

Current behavior: `pnpm db:up` cannot connect to Docker Desktop, and Prisma
cannot reach `localhost:5433`. Fresh integration, migration-upgrade, and E2E
gates therefore fail.

Expected behavior: Docker/PostgreSQL test infrastructure starts, migrations
apply, and DB-dependent tests run green or expose real code defects.

Reproduce: run `pnpm db:up`, then `pnpm db:migrate`, `pnpm test:integration`,
`pnpm test:migration`, and `pnpm test:e2e` in this workspace.

Risk: the project cannot satisfy Definition of Done or prove Operations
regression safety on the current machine.

Suggested fix: start Docker Desktop Linux engine, confirm port 5433 is free,
run `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, then rerun full gates.

Regression test needed: none in app code; this is an environment gate. CI should
remain the canonical proof after local remediation.

### SEC-H-01 - Non-Operations mutations do not share the mutation security contract

Severity: High. Type: Confirmed defect.

Files and lines:
- `src/shared/http/api-handler.ts:74-99` enforces Origin, content type, and rate
  limit only for `withOperationsJsonMutation`.
- `src/shared/http/api-handler.ts:101-134` generic `parseJson` has body-size and
  Zod validation but no content-type or Origin check.
- `app/api/v1/orders/route.ts:18-33` checkout mutation uses `parseJson`.
- `app/api/v1/admin/inventory/[variantId]/actions/adjust/route.ts:10-27` uses
  `parseJson`.
- `app/api/v1/auth/reset-password/route.ts:12-39` uses `request.json()` directly
  and has no rate limit.

Current behavior: cart, checkout, admin catalog/inventory/service-area, and
reset-password mutations do not consistently reject bad Origin, wrong
Content-Type, oversized bodies at the same small mutation cap, or excessive
request rates.

Expected behavior: every cookie-authenticated or sensitive mutation should use
a centralized server-side contract: allowed-origin validation, endpoint-appropriate
Content-Type, body cap, rate limit, and structured 400/403/413/415/429 responses.

Reproduce: send a cross-origin or `text/plain` request with valid JSON to
`POST /api/v1/orders` or admin inventory adjustment. The code path reaches
`parseJson` rather than the Operations security wrapper.

Business impact: checkout/admin actions are more exposed to CSRF-style mutation
attempts and local resource abuse.

Security impact: inconsistent trust-boundary enforcement across P0 flows.

Suggested fix: generalize `withOperationsJsonMutation` into a shared
`withJsonMutation` with per-route scopes and size caps, then migrate all
non-GET mutations.

Regression tests needed: API tests for bad Origin, bad Content-Type, too-large
body, and rate limit on checkout, cart item mutation, admin inventory adjustment,
register/forgot/reset password.

### ORD-H-01 - Technician completion bypasses payment guard

Severity: High. Type: Confirmed defect.

Files and lines:
- `docs/ORDER_STATE_MACHINE.md:66` requires payment policy for
  `INSTALLATION_IN_PROGRESS -> COMPLETED`.
- `src/modules/operations/application/operations-service.ts:695-709` updates an
  order to `COMPLETED` using only `id` and `INSTALLATION_IN_PROGRESS`.
- `tests/fixtures/operations.ts:540-575` creates fixture orders without a
  payment row.
- `tests/integration/operations.test.ts:258-285` expects technician completion
  to complete the order without asserting payment.

Current behavior: an assigned technician can complete an installation and move
the order to `COMPLETED` even when the fixture order has no payment row and no
`PAID` status.

Expected behavior: installation completion must check payment policy in the same
transaction before setting the order to `COMPLETED`.

Reproduce: create an Operations fixture, drive `en-route`, `arrive`, `start`,
then `complete`; the existing integration test expects `OrderStatus.COMPLETED`
without setting payment `PAID`.

Business impact: unpaid COD or bank-transfer orders can be marked completed,
breaking revenue and reconciliation.

Security impact: operational users can accidentally or deliberately bypass a
financial state guard.

Suggested fix: in technician `complete`, load/check the order payment status in
the transaction, require `PAID`, and add a negative test for pending/missing
payment.

Regression tests needed: integration test that technician complete with
`PaymentStatus.PENDING` or missing payment is rejected and rolls back
appointment, assignment, order, and audit.

### PAY-H-01 - Manual payment confirmation action is missing

Severity: High. Type: Confirmed missing functionality.

Files and lines:
- `docs/ORDER_STATE_MACHINE.md:80` says payment confirmation must use a separate
  payment action, not order action.
- `docs/ORDER_STATE_MACHINE.md:98-101` requires staff/manager manual payment
  confirmation for bank transfer.
- `app/api/v1/admin/orders/[id]/actions/route.ts:17-30` exposes only order
  state actions through `transitionOrder`.
- `src/modules/commerce/domain/order-transition.ts:121-132` blocks bank-transfer
  confirm and completion unless payment is `PAID`.

Current behavior: the code enforces paid-payment guards in order policy, but no
admin payment action route/use case exists to transition `PENDING -> PAID/FAILED`
with authorization and audit.

Expected behavior: a STAFF/MANAGER/ADMIN-authorized payment action should update
payment status, validate amount/order ownership/state, require a reason/reference
as needed, and write audit in the same transaction.

Reproduce: create a `BANK_TRANSFER` order with payment `PENDING`; there is no
HTTP route or application service to mark it `PAID`, so the documented order
flow cannot proceed without direct DB modification.

Business impact: bank-transfer orders are operationally stuck, or staff will be
tempted to edit DB state manually.

Security impact: manual DB changes bypass audit, authorization, and state guards.

Suggested fix: implement `POST /api/v1/admin/payments/[id]/actions` or an
order-scoped payment action route with centralized mutation security,
conditional version update, payment state policy, and audit.

Regression tests needed: positive/negative payment confirmation integration
tests, permission tests, amount mismatch test, audit rollback test, and E2E
admin payment confirmation flow.

## 5. Medium Findings

### PERF-M-01 - Several list/read endpoints are unbounded

Severity: Medium. Type: Confirmed defect / production concern.

Files and lines:
- `src/modules/commerce/application/commerce-service.ts:592-599` lists all own
  orders with full includes and no `take`.
- `src/modules/commerce/application/commerce-service.ts:241-258` lists all own
  addresses.
- `src/modules/commerce/application/commerce-service.ts:610-632` lists slots for
  any date range without a max range or limit.
- `src/modules/catalog/application/catalog-service.ts:559-575` lists all service
  areas.

Current behavior: some lists can grow without pagination or date-range caps.

Expected behavior: list endpoints should use cursor/limit caps, stable ordering,
and bounded date ranges.

Reproduce: seed many orders/addresses/slots and call the corresponding APIs; the
query has no `take` cap.

Impact: slow responses, excessive memory, and easier denial-of-service on
customer and operational flows.

Suggested fix: add cursor/limit schemas for orders/addresses/service areas and a
small max date range for installation slots.

Regression tests needed: pagination contract tests and max-range rejection tests.

### SCM-M-01 - Git state and history cannot be audited

Severity: Medium. Type: Missing evidence.

Files and lines:
- Workspace root has no `.git` metadata.
- `.gitignore:8-16` ignores local env/generated artifacts, but tracking status
  cannot be verified here.

Current behavior: `git status` and `git log` both fail.

Expected behavior: audits should be run in a Git-backed checkout so branch,
uncommitted files, migration changes, and history/secret exposure can be
verified.

Reproduce: run `git status --short --branch` in the project directory.

Impact: cannot prove which files are reviewed, whether `.env` was ever tracked,
or whether migrations changed after review.

Suggested fix: restore or run from a real Git checkout and repeat status/log and
secret-history checks.

Regression test needed: CI/reporting checklist requiring `git status` evidence.

### SUP-M-01 - Dependency audit reports moderate transitive advisories

Severity: Medium. Type: Confirmed dependency risk.

Files and lines:
- `package.json:33-47` uses `next` and `next-auth`.
- `pnpm-lock.yaml` resolves transitive `postcss` and `uuid`.

Current behavior: `pnpm audit --prod` reports two moderate advisories:
`postcss <8.5.10` via `next`, and `uuid <11.1.1` via `next-auth`.

Expected behavior: dependency advisories should be triaged, patched by compatible
upgrades, or accepted with documented exposure analysis.

Reproduce: run `pnpm audit --prod`.

Impact: supply-chain risk remains untriaged.

Suggested fix: inspect whether patched `next`/`next-auth` versions are available
and compatible, update in a controlled dependency remediation, or document
non-exploitability with owner approval.

Regression test needed: add a CI dependency-audit or advisory-review step.

### OBS-M-01 - Structured application logging/metrics are not implemented

Severity: Medium. Type: Missing evidence / production concern.

Files and lines:
- `docs/PRODUCT_REQUIREMENTS.md:246-251` requires structured logs and metrics.
- `src/shared/http/response.ts:23-64` returns request IDs but does not log.
- `src/shared/http/api-handler.ts:173-242` maps errors but does not emit
  structured events or metrics.

Current behavior: responses carry `X-Request-Id`, but there is no application
logger, redaction policy implementation, or metric events for checkout conflict,
inventory shortage, or slot conflict.

Expected behavior: structured logs with request ID, actor/resource allowlist,
duration/outcome, and no PII/secret leakage.

Reproduce: search for `logger`, `console`, `metric`, or tracing implementation;
only response request IDs are present.

Impact: incidents and business failures are harder to investigate safely.

Suggested fix: add a minimal server logger abstraction and instrument request
boundaries plus critical business conflicts.

Regression tests needed: log redaction/unit tests for sensitive fields and
handler tests verifying expected event names.

### SEC-M-02 - Rate limiting is process-local

Severity: Medium. Type: Production concern.

Files and lines:
- `src/modules/identity/infrastructure/rate-limiter.ts:1-44`.
- `docs/decisions/ADR-001-identity-local-credentials.md:23` acknowledges this
  limitation.

Current behavior: rate limits use a process-local `Map`.

Expected behavior: production/multi-instance deployments need a shared store or
edge control.

Reproduce: run multiple app instances; each process has its own quota.

Impact: brute-force and mutation-abuse controls weaken in multi-instance
deployment.

Suggested fix: keep local implementation for tests, but add an approved shared
rate-limit adapter before production.

Regression tests needed: adapter contract tests and fail-closed behavior tests.

### DOC-M-01 - Project documentation is stale versus implementation

Severity: Medium. Type: Confirmed documentation drift.

Files and lines:
- `README.md:5` still says status is Slice 2 Identity and Access.
- `README.md:373-381` still says cart, checkout, order, and payment remain later
  slices.
- Current source contains cart, checkout, order, catalog, and Operations routes.

Current behavior: README status and limitations understate implemented slices.

Expected behavior: README should match current implementation and known blocked
areas.

Reproduce: compare README with `app/api/v1/orders/route.ts`,
`app/admin/operations/page.tsx`, and Operations report V2.

Impact: onboarding/reviewers may run wrong assumptions and skip required gates.

Suggested fix: update README after remediation to reflect current slices and
remaining gaps.

Regression test needed: documentation review checklist tied to release notes.

## 6. Low Findings

### DOC-L-01 - API pagination envelope and cursor wording are inconsistent

Severity: Low. Type: Documentation drift.

Files and lines:
- `docs/API_CONTRACT.md:34-40` documents `meta.nextCursor`.
- Implementations commonly return `{ data: { items, nextCursor }, meta:
  { requestId } }`.

Suggested fix: either update the API contract or adapt response helpers to match
the contract.

### TOOL-L-01 - Prisma package.json config deprecation warning

Severity: Low. Type: Maintenance concern.

Files and lines:
- `package.json:28-30` uses deprecated `package.json#prisma`.

Evidence: `pnpm db:migrate` emitted Prisma's warning that the property will be
removed in Prisma 7.

Suggested fix: migrate to `prisma.config.ts` in a maintenance task.

### SEC-L-01 - Local `.env` exists in a non-Git workspace

Severity: Low. Type: Missing evidence.

Files and lines:
- `.env` exists locally; values were not copied into this report.
- `.gitignore:8-10` ignores `.env*` except `.env.example`.

Current behavior: ignore rules look correct, but without Git metadata this audit
cannot prove `.env` was never tracked.

Suggested fix: repeat secret scan and `git status --ignored` in a Git checkout.

## 7. Requirement-To-File Traceability

| Requirement area | Implementation files reviewed |
|---|---|
| Next.js App Router / pages / route handlers | `app/**`, `next.config.ts` |
| Identity/Auth.js/session | `src/modules/identity/**`, `src/shared/auth/server.ts`, `app/api/auth/[...nextauth]/route.ts` |
| Authorization/roles | `src/modules/identity/domain/roles.ts`, `src/modules/catalog/application/authorization.ts`, Operations service |
| Catalog/inventory | `src/modules/catalog/**`, admin catalog routes, `prisma/migrations/20260713113000_catalog_inventory/migration.sql` |
| Cart/checkout/order | `src/modules/commerce/**`, cart/order routes, checkout integration tests |
| Operations | `src/modules/operations/**`, `src/components/operations/**`, Operations API routes, Operations fixtures/tests |
| Database/migrations | `prisma/schema.prisma`, all `prisma/migrations/**/migration.sql`, Operations rollback/runbook docs |
| CI/test config | `.github/workflows/ci.yml`, `vitest.config.ts`, `vitest.integration.config.ts`, `playwright.config.ts` |
| Environment | `.env.example`, `.gitignore`, `docker-compose.yml`, `src/shared/validation/env.ts` |

## 8. Finding-To-Test Traceability

| Finding | Existing test evidence | Required regression |
|---|---|---|
| ENV-H-01 | Failing fresh gates prove blocker. | Rerun full gates after Docker/PostgreSQL restoration. |
| SEC-H-01 | Operations has negative wrapper tests; non-Operations equivalent is missing. | Add negative mutation-security API tests for checkout/cart/admin/auth reset. |
| ORD-H-01 | Existing Operations completion test misses payment and fixture lacks payment. | Add pending/missing payment denial test for technician complete. |
| PAY-H-01 | Order policy tests require `PAID`, but no payment action tests exist. | Add payment action policy/integration/E2E tests. |
| PERF-M-01 | Operations pagination tests exist; customer order/address/slot caps missing. | Add pagination/range tests. |
| SCM-M-01 | Not testable in app code. | Add release/audit checklist with Git evidence. |
| SUP-M-01 | `pnpm audit --prod` reports advisories. | Add dependency-audit/triage CI step. |
| OBS-M-01 | No logger tests found. | Add log redaction and event emission tests. |

## 9. Migration And Rollback Risk

No database reset/drop/truncate was run. No migration was modified. Migration
SQL was reviewed, including Operations forward-fix and rollback notes.

Current migration risk is not a new SQL defect from this audit; the blocker is
that migration execution could not be verified locally because PostgreSQL was
unavailable. Before any later remediation or Prompt 8, rerun `pnpm db:migrate`
and `pnpm test:migration` successfully after Docker is restored.

## 10. Remediation Order

1. Restore Docker/PostgreSQL locally and rerun all required gates.
2. Fix ORD-H-01 payment guard bypass in technician completion.
3. Implement PAY-H-01 manual payment action with audit and tests.
4. Apply a shared mutation security wrapper to non-Operations mutations.
5. Add pagination/range caps for unbounded customer/service-area/slot lists.
6. Triage dependency advisories and add dependency audit policy.
7. Add structured logging/metrics and update README/API docs.

## 11. Human Approval Needed

- Payment operation policy: who may mark COD/BANK_TRANSFER as `PAID` or
  `FAILED`, required evidence/reference, and whether dual approval is needed.
- Production rate-limit store and logging provider.
- Dependency advisory triage decision if patched versions require framework
  upgrades.
- Git-backed audit baseline and handling of local `.env` evidence.

## 12. Checked Areas With No Confirmed Defect

- No `dangerouslySetInnerHTML`, browser token storage, `eval`, `.skip`, `.only`,
  `test.fixme`, or `waitForTimeout` found in source/tests.
- Passwords are hashed with bcrypt; profiles do not return `passwordHash`.
- Auth.js session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in
  production mode.
- Product/evidence local storage uses generated keys, extension/MIME/signature
  checks, size limits, and production disable guards.
- Public product image read does not expose physical paths.
- Operations candidate technician list is bounded and paginated.
- Operations technician ownership checks are server-side.
- Operations evidence preview is server-authorized and `private, no-store`.
- Admin order transition policy uses conditional update and inventory side
  effects per the V2 report source evidence.

## 13. Prompt 8 Readiness

The project is **not ready to run Prompt 8** yet. It is blocked until full gates
pass on a working PostgreSQL/Docker environment and the High findings above are
remediated or explicitly accepted by a human owner.
