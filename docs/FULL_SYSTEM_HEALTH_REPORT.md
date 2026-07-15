# 247 Home Full System Health Report

Audit date: 2026-07-15, Asia/Bangkok  
Audit scope: full workspace, current local PostgreSQL database, current source
tree, all documentation, migrations, configuration, unit/integration/migration
and E2E tests.

## 1. Executive decision

**BLOCKED**

The implemented scope is stable: all fresh quality gates pass, the current
source has no unresolved Critical or High finding, PostgreSQL concurrency tests
pass, all 11 migrations are applied, and the final Playwright run passes 14/14
after the latest migration and code changes.

Staging promotion remains blocked for release-governance reasons:

1. This workspace has no `.git` metadata, so branch provenance, the exact diff,
   tracked-secret history and commit integrity cannot be verified.
2. The documented target MVP still includes customer warranty APIs, warranty
   mutations, customer order cancellation, admin role management and admin slot
   CRUD, but those routes are not implemented. README and API contract now mark
   these as planned instead of claiming they exist.
3. The reused local database contains six legacy Operations fixture namespaces:
   24 old `RESERVED` order items have no allocation ledger and three old slots
   have historical counter mismatches. New code fails closed on those orders;
   no automatic deletion or guessed history rewrite was performed.
4. Backup/restore rehearsal, a staging secret manager, HTTPS/trusted-proxy
   configuration, a shared multi-instance rate limiter, approved monitoring and
   a deployment checklist have not been verified.

This report supersedes release status statements in older reports for the
current workspace. Older reports remain unchanged as historical evidence.

Unresolved severity count: Critical 0, High 0, Medium 6, Low 4.

## 2. Project overview and system map

247 Home is a Next.js App Router modular monolith using strict TypeScript,
PostgreSQL 16, Prisma, Auth.js, Tailwind CSS, Vitest and Playwright.

| Area | Current implementation |
|---|---|
| Frontend | Server-rendered storefront/account/order pages; client checkout flow; Admin Operations and Technician consoles with server-backed actions |
| HTTP | App Router handlers under `app/api`; shared validation, mutation security, error envelope, cache and request logging |
| Domain/application | Identity, Catalog, Commerce and Operations services; order/payment/installation policies remain server-side |
| Persistence | Prisma for normal access; parameterized PostgreSQL locking isolated in infrastructure repositories |
| Data integrity | FK/unique/check/index constraints, optimistic versions, row/advisory locks, technician overlap exclusion constraint and inventory allocation ledger |
| Security | Auth.js JWT session checked against DB `authVersion`; role/owner/assignment guards; Origin/type/body/rate controls; generated upload keys |
| Testing | Unit policy/boundary tests, PostgreSQL integration/concurrency tests, migration-upgrade harness and Chromium E2E workflows |

No UI talks directly to the database. Route handlers parse and delegate; state,
price, payment, inventory, authorization and audit decisions remain in
domain/application services.

## 3. Baseline evidence

Before this health remediation, the restored Docker/PostgreSQL environment
already allowed the baseline gates to run. Baseline unit tests passed 47 tests,
integration passed 41 tests and E2E passed 14 tests. Source review and direct DB
queries then exposed defects not caught by that baseline, including concurrent
reset-token reuse, missing per-order reservation ownership, unsafe seed updates,
default-address races, BigInt response failures and stale documentation.

`git status` and `git log` could not run at baseline or final validation because
the supplied directory is not a Git checkout.

## 4. Findings fixed during health remediation

### IAM-H-01: password reset token could be used concurrently

- **Severity:** High, fixed.
- **File:** `src/modules/identity/application/identity-service.ts:134`.
- **Root cause:** the token was read as unused and later updated without a
  conditional claim, so two transactions could both pass the read check.
- **Impact:** concurrent requests could race to set different passwords and
  increment `authVersion` more than once.
- **Fix:** claim the exact token with conditional `updateMany` on token ID, hash,
  `usedAt IS NULL` and future expiry, require count 1, then update password,
  `authVersion` and sibling tokens in the same transaction.
- **Regression test:** `tests/integration/identity.test.ts:135` proves one success,
  one `INVALID_RESET_TOKEN`, one valid resulting password and one version bump.

### INV-H-01: inventory reservations had no per-order ownership

- **Severity:** High, fixed for all new and safely reconcilable data.
- **Files:** `prisma/schema.prisma:379`,
  `prisma/migrations/20260715100000_inventory_allocation_integrity/migration.sql:7`,
  `src/modules/commerce/application/commerce-service.ts:571`,
  `src/modules/commerce/application/commerce-service.ts:864`.
- **Root cause:** `inventory.reserved` was only an aggregate counter. A specific
  order transition could not prove which quantity it owned before consuming it.
- **Impact:** one order could consume reservation quantity attributable to a
  different order; ambiguous legacy rows could not be repaired safely.
- **Fix:** add one `InventoryAllocation` per order item, create it in checkout,
  validate item/variant/quantity/status and conditionally move
  `RESERVED -> CONSUMED` while updating inventory, order and audit in one
  transaction. Migration backfills only histories it can infer safely and emits
  `INVENTORY_ALLOCATION_RECONCILIATION_REQUIRED` for ambiguous rows.
- **Regression tests:** `tests/integration/order-transitions.test.ts:258` covers
  exactly-once consumption/retry; lines 320 and 369 cover missing allocation and
  PostgreSQL update rollback; line 201 covers concurrent order version writes.

### DATA-H-01: concurrent default addresses could violate the invariant

- **Severity:** High, fixed.
- **Files:** `src/modules/commerce/application/commerce-service.ts:242`,
  `src/modules/commerce/infrastructure/checkout-repository.ts:12`,
  `prisma/migrations/20260715101000_address_default_integrity/migration.sql:29`.
- **Root cause:** clearing the old default and creating a new default had no
  per-user serialization or database uniqueness constraint.
- **Impact:** a customer could end with multiple active default addresses.
- **Fix:** serialize default changes with a per-user advisory transaction lock
  and add a partial unique index. Migration fails clearly with
  `ADDRESS_DEFAULT_HISTORY_INVALID` rather than rewriting ambiguous duplicates.
- **Regression test:** `tests/integration/checkout.test.ts:295` runs concurrent
  defaults and directly proves PostgreSQL rejects a second default.

### PAY-H-01: payment confirmation did not verify immutable order amount

- **Severity:** High, fixed.
- **File:** `src/modules/commerce/application/commerce-service.ts:996`.
- **Root cause:** payment status policy checked state/version but not whether the
  stored payment amount/currency still matched its order snapshot.
- **Impact:** corrupted or manually altered payment data could be marked paid.
- **Fix:** compare payment amount/currency with order grand total/currency before
  the conditional transition; payment, version and audit remain transactional.
- **Regression test:** `tests/integration/payment-workflow.test.ts:169` proves
  `PAYMENT_AMOUNT_MISMATCH` leaves status, version and audit unchanged.

### ENV-H-01: Auth.js secret configuration failed late

- **Severity:** High, fixed.
- **Files:** `src/shared/validation/env.ts:3`,
  `src/modules/identity/infrastructure/auth-options.ts:8`.
- **Root cause:** server environment validation covered only `DATABASE_URL`, and
  Auth.js read an optional raw environment variable.
- **Impact:** an app could build/start with an empty or short session secret and
  fail only on authentication traffic.
- **Fix:** require a 32-character minimum secret, valid Auth.js URL, optional
  valid app origin and explicit proxy flag; Auth.js consumes the validated
  value. A random 44-character secret was generated only in ignored local
  `.env`; its value was never printed or added to source.
- **Regression test:** `tests/unit/env.test.ts:5` accepts the complete contract and
  rejects missing/short/invalid values.

### API-H-01: Prisma BigInt could break JSON and UI money lost precision

- **Severity:** High, fixed.
- **Files:** `src/shared/http/response.ts:42`,
  `src/shared/money/format-vnd.ts:1`, catalog/commerce pages and checkout flow.
- **Root cause:** generic responses could receive Prisma `bigint`, while several
  UI paths converted decimal money strings through JavaScript `Number`.
- **Impact:** admin mutation responses could throw during serialization and large
  VND values could be rounded above `MAX_SAFE_INTEGER`.
- **Fix:** response serialization converts every BigInt to its decimal string;
  all money rendering uses string/BigInt-safe `formatVnd` and BigInt sums.
- **Regression tests:** `tests/unit/http-response.test.ts:56`,
  `tests/unit/format-vnd.test.ts:5`, and
  `tests/integration/catalog.test.ts:200` cover precise HTTP/UI boundaries.

### OPS-M-01: checkout installation state and slot date contract drifted

- **Severity:** Medium, fixed.
- **Files:** `src/modules/commerce/application/commerce-service.ts:556`,
  `src/modules/commerce/application/commerce-service.ts:686`,
  `src/shared/date/service-time.ts:1`.
- **Root cause:** checkout used a legacy initial appointment state, slot capacity
  had a client field-name mismatch and date formatting depended on machine/UTC
  date behavior.
- **Impact:** new appointments could be operationally stuck, UI showed missing
  capacity, and date boundaries could shift outside Vietnam service time.
- **Fix:** create `ASSIGNMENT_PENDING`, use the API `available` field, query and
  render dates explicitly in `Asia/Ho_Chi_Minh`.
- **Regression tests:** `tests/integration/checkout.test.ts:191` and line 332;
  `tests/unit/service-time.test.ts:5`; checkout E2E happy path.

### OPS-M-02: assignment and reschedule application races were under-guarded

- **Severity:** Medium, fixed.
- **Files:** `src/modules/operations/application/operations-service.ts:280`,
  `src/modules/operations/application/operations-service.ts:379`,
  `src/modules/operations/infrastructure/operations-repository.ts:13`.
- **Root cause:** assignment did not conditionally write appointment
  status/version, while reschedule did not consistently lock appointment plus old
  and new slots in stable order or reject cross-area/past direct requests.
- **Impact:** duplicate assignment audit/state or slot corruption under races;
  direct API behavior could differ from UI validation.
- **Fix:** row locks, stable slot lock order, conditional version/status writes,
  exclusion constraint mapping, service-area and future-time guards, and audit in
  the same transaction.
- **Regression tests:** `tests/integration/operations.test.ts:116`, lines 247,
  285, 323 and 572; reschedule/assignment E2E specs.

### SEC-M-01: shared mutation boundary had proxy/body edge cases

- **Severity:** Medium, fixed.
- **File:** `src/shared/http/api-handler.ts:70` and line 126.
- **Root cause:** forwarding headers were usable as rate-limit identity without a
  trusted-proxy switch, and no-body DELETE mutations did not consume/cap chunked
  request bodies.
- **Impact:** clients could evade process-local quotas through spoofed headers or
  send unnecessary large bodies to DELETE endpoints.
- **Fix:** trust proxy headers only when explicitly configured, keep a fail-closed
  common bucket otherwise, centralize bounded body reads and allow zero bytes for
  no-body mutations. Structured 403/413/415/429 errors remain server-side.
- **Regression tests:** `tests/unit/api-handler.test.ts:118` and line 187, plus
  existing bad-origin/type/size/rate tests in the same file.

### FILE-M-01: product-image write occurred too close to authorization boundary

- **Severity:** Medium, fixed.
- **Files:** `app/api/v1/admin/products/[id]/images/route.ts:20`,
  `src/modules/catalog/infrastructure/local-image-storage.ts:50`.
- **Root cause:** local persistence could be reached before all actor/path checks,
  and cleanup failure was previously swallowed.
- **Impact:** unauthorized disk write attempts and orphan files on compound
  failure paths.
- **Fix:** authorize and validate product ID before writing, reject traversal
  filenames, return no local images in production, and propagate aggregate
  persistence/cleanup failure after all cleanup attempts run.
- **Regression tests:** `tests/unit/catalog-image-storage.test.ts:6` and
  `tests/integration/catalog.test.ts:247`.

### CAT-M-01: service-area fee mutations lacked a same-transaction audit

- **Severity:** Medium, fixed.
- **Files:** `src/modules/catalog/application/catalog-service.ts:600`,
  `app/api/v1/admin/service-areas/route.ts`,
  `app/api/v1/admin/service-areas/[id]/route.ts`.
- **Root cause:** service-area fee CRUD did not carry request ID into a shared
  mutation/audit transaction.
- **Impact:** sensitive fee changes could not be attributed reliably.
- **Fix:** mutation and redacted audit now share one transaction and request ID;
  money DTO fields are decimal strings.
- **Regression test:** `tests/integration/catalog.test.ts:163`.

### CART-M-01: repeated add-to-cart could exceed aggregate quantity limit

- **Severity:** Medium, fixed.
- **File:** `src/modules/commerce/application/commerce-service.ts:190`.
- **Root cause:** schema limited each incoming quantity but an existing row could
  be incremented beyond 99.
- **Impact:** oversized cart rows and downstream arithmetic/resource abuse.
- **Fix:** conditional database update requires existing quantity to remain under
  the aggregate cap and returns a structured conflict otherwise.
- **Regression test:** `tests/integration/checkout.test.ts:274`.

### SEED-M-01: development seed could corrupt mutable counters on rerun

- **Severity:** Medium, fixed.
- **File:** `prisma/seed.ts:316`, line 385 and line 773.
- **Root cause:** inventory upsert reset `reserved` and stock, slot upsert reset
  `bookedCount`, and READY demo orders had no item/allocation ownership.
- **Impact:** rerunning seed after local orders could break inventory/slot
  invariants and produce unrealistic Operations demos.
- **Fix:** preserve existing mutable inventory, isolate Operations data in
  `HCM-OPS-DEMO`, create deterministic item/payment/consumed allocations, reset
  only owned appointments and reconcile only isolated demo slots from appointment
  truth. Seed remains blocked in production.
- **Regression evidence:** `pnpm db:seed` passed twice consecutively; SQL then
  proved both demo orders had one consumed allocation, matching payment/total and
  matching slot counts.

### ARCH-M-01: PostgreSQL lock SQL leaked into application services

- **Severity:** Medium, fixed.
- **Files:** `src/modules/commerce/infrastructure/checkout-repository.ts`,
  `src/modules/operations/infrastructure/operations-repository.ts`.
- **Root cause:** parameterized lock queries were correct but placed in
  application orchestration contrary to the repository boundary in `AGENTS.md`.
- **Impact:** database-specific behavior was harder to review and reuse without
  duplicating details in business services.
- **Fix:** move advisory/row/slot/assignment lock primitives to infrastructure
  adapters without changing SQL, lock order or transaction owner.
- **Regression tests:** the final 52 PostgreSQL integration tests and 14 E2E tests
  exercise checkout, address, assignment, reschedule and technician locks after
  the refactor.

### TEST-M-01: fixture and local mail residue survived some test paths

- **Severity:** Medium, fixed for new runs.
- **Files:** `tests/integration/checkout.test.ts:362`,
  `tests/fixtures/operations.ts:135`,
  `tests/integration/identity.test.ts:48`, `tests/e2e/checkout.spec.ts:18`.
- **Root cause:** older checkout teardown was incomplete; Identity tests did not
  remove local outbox files created by their own run.
- **Impact:** local DB/files accumulated and could influence later tests/audits.
- **Fix:** namespace-scoped cleanup includes allocations/audit/evidence; checkout
  cleans all owned rows; Identity snapshots the outbox and removes only newly
  created files with aggregate-error cleanup.
- **Regression tests/evidence:** `tests/integration/operations.test.ts:853`
  simulates browser-close failure; after the final integration run outbox count
  remained unchanged, and evidence/product upload directories contained zero
  files after E2E.

## 5. Previously reported findings revalidated

| Prior finding | Current status | Fresh evidence |
|---|---|---|
| Operations H-01/H-02 order lost update and inventory side effects | FIXED | Conditional order write plus allocation transaction; order concurrency/rollback integration tests pass |
| Operations H-03 unsafe assignment timestamp migration | FIXED | Forward-fix migration backfills earliest trustworthy timestamp and validates constraint; migration-upgrade test passes |
| Operations H-04/M-01 technician double submit and cleanup | FIXED | Technician E2E completes all states with concurrent EN_ROUTE; cleanup-failure integration passes |
| Operations M-02 unbounded candidates | FIXED | Default/cap 25/100, stable ordering, area/active/overlap filtering and paged UI |
| Operations M-03 mutation contract | FIXED | Shared Origin/type/body/rate wrapper and negative tests pass |
| Operations M-04 application concurrency | FIXED | Concurrent order, assignment and technician action tests each produce one success and one conflict |
| Operations M-05 authenticated cache | FIXED | `private, no-store`; dedicated E2E passes |
| Operations M-06 money precision | FIXED | String/BigInt formatter and JSON regression tests pass |
| Project ORD-H-01 unpaid technician completion | FIXED | `operations-service.ts:738`; `operations.test.ts:445` rejects pending payment atomically |
| Project PAY-H-01 manual payment action missing | FIXED | Payment policy/service/routes; unit, integration and payment E2E pass |
| Project PERF-M-01 unbounded lists | FIXED | Cursor/limit caps and 31-day slot range; pagination tests pass |
| Project SUP-M-01 dependency advisories | FIXED | Production bulk audit: 148 packages, no moderate-or-higher advisory |
| Project OBS-M-01 structured logging absent | FIXED | Allowlisted request logger and redaction unit test |
| Project SCM-M-01 Git evidence unavailable | NOT FIXED | No `.git` directory supplied |

## 6. Database and transaction review

### Transaction boundaries

- **Checkout:** idempotency attempt claim, cart lock, price rebuild, inventory
  locks/reservation, slot lock/capacity, order/items/payment/appointment/allocation,
  cart close and attempt linkage commit together.
- **Order ready transition:** order lock and policy, allocation validation,
  inventory conditional decrement, allocation consume, conditional
  `id + version + status + inventoryStatus` order write and audit commit together.
- **Payment:** payment row lock, amount/currency guard, conditional version/state
  update and audit commit together.
- **Technician:** appointment/assignment and order locks, payment/order guards,
  appointment/assignment/order state writes and audit commit together.
- **Assignment/reschedule:** appointment and stable slot locks, exclusion/capacity
  guards, conditional appointment write, assignment mutation and audit commit
  together.
- **Default address:** per-user advisory lock, old-default clear and new address
  create commit together; partial unique index is the final guard.

### Migration changes

1. `20260715100000_inventory_allocation_integrity` is an additive forward
   migration. It creates the allocation ledger, constraints/FKs/indexes and only
   backfills histories that can be inferred exactly. Ambiguous history remains
   blocked and visible for human reconciliation.
2. `20260715101000_address_default_integrity` detects invalid history before
   creating the partial unique index. It does not silently choose a default.
3. Rollback/forward-fix notes now sit beside all 11 migrations. The first four
   historical migrations received documentation only; no applied SQL or checksum
   was edited.
4. Migration upgrade harness now applies through payment, allocation and address
   migrations and proves valid history succeeds while invalid Operations/address
   history fails and rolls back without data loss.

Lock/downtime notes: the new table/FK/index and backfill scan order/inventory
history; the partial unique address index scans and briefly blocks conflicting
writes. Dry-run against a staging copy and take a verified backup before applying
to a large shared database. Rollback is application rollback or a new forward
fix, never table/data deletion.

### Direct database health snapshot

Final read-only SQL after E2E reported:

| Invariant | Result |
|---|---|
| Unvalidated PostgreSQL constraints | 0 |
| New inventory allocation aggregate vs `inventory.reserved` mismatches | 0 |
| Consumed/released allocation lifecycle mismatches | 0 |
| Payment amount/currency vs order mismatches | 0 |
| Order snapshot total mismatches | 0 |
| Duplicate active default-address users | 0 |
| Appointment/slot/order service-area mismatches | 0 |
| Legacy RESERVED order items without allocation | 24, all from six old fixture namespaces |
| Legacy slot counter mismatches | 3 old local slots |

The 24 ambiguous rows and three slots were deliberately not rewritten or
deleted. A human can inspect the namespace-scoped cleanup command documented in
`docs/RELEASE_CANDIDATE_REPORT.md`; checkout residue without a namespace needs a
separate approved reconciliation plan.

## 7. Security review

- Passwords use bcrypt and are never returned by profile/order APIs.
- Reset tokens are hashed in DB, expire, are one-use under concurrency and local
  mail files use owner-only mode. Test-created files are cleaned for new runs.
- Auth.js session cookie is HttpOnly, SameSite Lax and Secure in production;
  every request resolves an active DB actor and matching `authVersion`.
- Role, ownership and technician assignment authorization is enforced in server
  services. E2E directly proves customer admin denial and cross-technician IDOR
  denial for read/action.
- Sensitive mutations enforce allowed Origin, endpoint media type, bounded body,
  rate limit and no-store responses. Forwarded IP headers are disabled unless a
  trusted ingress is explicitly configured.
- Authenticated list/detail responses are `private, no-store`; public catalog
  caching remains intentionally bounded.
- Product/evidence images validate generated storage keys, basename/extension,
  MIME, signature and decoded size. Physical paths are never returned and local
  storage is disabled in production.
- Error mapping returns structured generic errors without stack, SQL, credentials
  or raw PII.
- Static scans found no `dangerouslySetInnerHTML`, browser token storage,
  `eval`, unsafe raw SQL, skipped/only tests, hardcoded production credential or
  private key. Matches were limited to explicit local/test PostgreSQL defaults.
- Production dependency audit found no moderate-or-higher advisory in 148
  production packages.

## 8. Test coverage and quality

| Layer | Final result | Important behavior covered |
|---|---|---|
| Unit | 16 files, 53 tests | State/payment policy, mutation security, env, money, JSON BigInt, upload traversal, timezone, logging/redaction, pagination/rate adapter |
| Integration | 7 files, 52 tests on PostgreSQL | Checkout/inventory/slot races, reset race, IDOR, order/payment concurrency, transaction rollback, assignment/reschedule/exclusion/audit/evidence cleanup/pagination |
| Migration | PASS | Progressed Operations history, timestamp constraints, latest additive migrations, invalid-history rollback and data preservation |
| E2E | 14/14, Chromium, one worker | Catalog, checkout success/out-of-stock, health/admin denial, assignment/audit, no-store, IDOR, reschedule conflict, STAFF denial, full technician workflow, payment conflict, own-job pagination |

Playwright uses no arbitrary `waitForTimeout`, one worker, no retry to turn red
tests green, trace retained on failure and screenshot only on failure. No
`.skip`, `.only` or `fixme` was found.

## 9. Commands executed and final results

| Command/check | Final result |
|---|---|
| `git status --short --branch` | FAIL as environment/provenance: not a Git repository |
| `pnpm install --frozen-lockfile` | PASS, lockfile current |
| `docker compose ps` | PASS, PostgreSQL 16 container healthy on local port 5433 |
| `pnpm db:migrate` | PASS, 11 migrations, no pending migration |
| `pnpm db:seed` twice | PASS twice; deterministic demo invariants verified by SQL |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS, zero warnings |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 16 files and 53 tests |
| `pnpm test:integration` | PASS, 7 files and 52 tests on PostgreSQL |
| `pnpm test:migration` | PASS, valid upgrade plus invalid-history rollback |
| `CI=1 pnpm test:e2e` | PASS, 14/14 on a fresh server after final migration/code |
| `pnpm audit:prod` | PASS, 148 production packages and no moderate-or-higher advisory |
| `pnpm build` | PASS, Next.js production build and TypeScript complete |
| Static secret/dangerous-pattern scans | PASS for source; local `.env` excluded and never printed |
| Post-test upload residue check | PASS, evidence temporary/final and product-image directories each contain 0 files |
| Post-test fixture check | No namespace from the final run; six known legacy namespaces remain |

No command result from before the final env/test cleanup changes was used as the
release evidence above.

## 10. Refactors and files changed

### Refactors

- Moved PostgreSQL locking SQL from application services to Commerce and
  Operations infrastructure repositories.
- Centralized BigInt-safe HTTP serialization, VND formatting, Vietnam service
  time and bounded request-body parsing.
- Replaced broad Commerce order reads with bounded `select` DTO queries and
  preserved bounded cursor pagination across all list routes.
- Strengthened fixture cleanup to be namespace/ownership scoped and
  failure-safe.

### Repository files changed by this health remediation

- **Configuration/docs:** `.env.example`, `README.md`,
  `docs/API_CONTRACT.md`, `docs/DATABASE_DESIGN.md`,
  `docs/INSTALLATION_STATE_MACHINE.md`, `docs/ORDER_STATE_MACHINE.md`, this
  report and migration rollback notes.
- **Database:** `prisma/schema.prisma`, `prisma/seed.ts`, migrations
  `20260715100000_inventory_allocation_integrity` and
  `20260715101000_address_default_integrity`.
- **Application/infrastructure:** Identity service/Auth options; Catalog service
  and local image storage; Commerce service and checkout repository; Operations
  service and repository; shared env/date/http response/api-handler helpers.
- **Routes/UI:** product image and service-area admin routes; cart/order/product,
  admin catalog/service-area pages; checkout and Operations consoles.
- **Tests/scripts:** migration-upgrade script and SQL fixtures; Identity,
  Catalog, Checkout, Order, Payment and Operations integration tests; Operations
  fixtures; checkout/payment E2E; env/API/money/time/upload response unit tests.

The local ignored `.env` was updated with a generated Auth.js secret. Its value
is not part of the repository or this report. Because Git metadata is absent,
this file inventory is reconstructed from the audit work log and filesystem;
the exact tracked diff must be verified in the real checkout.

## 11. Remaining risks

### REL-M-01: Git provenance unavailable

- **Severity:** Medium, release blocker.
- **Impact:** exact branch/diff, tracked `.env`, migration history edits and
  historical secret exposure cannot be proven.
- **Required action:** repeat status/log/diff/secret-history review in the actual
  Git checkout and run CI on the reviewed commit.

### SCOPE-M-01: documented target MVP is incomplete

- **Severity:** Medium, release-scope blocker.
- **Files:** `README.md:19`, `docs/API_CONTRACT.md:350`, line 403 and line 550.
- **Impact:** customer warranty create/list/detail, warranty state mutations,
  customer order cancellation, admin role management and admin installation-slot
  CRUD are unavailable.
- **Required action:** product owner must either reduce the staging acceptance
  scope in writing or schedule the missing vertical slices. They were not added
  during this bug-fix-only task.

### DATA-M-01: legacy local fixture history needs human reconciliation

- **Severity:** Medium for the reused local DB; new/fresh databases are not
  affected.
- **Impact:** 24 old orders fail closed at inventory consumption and three old
  slots have inaccurate historical counters.
- **Required action:** inspect and approve namespace cleanup; separately decide
  whether old checkout appointments can be deleted/released. Never invent
  allocation ownership or rewrite history silently.

### SEC-M-02: rate limiter is process-local

- **Severity:** Medium for multi-instance staging/production.
- **Impact:** each process has an independent quota; fail-closed untrusted proxy
  mode can also create a shared bucket behind an unconfigured ingress.
- **Required action:** choose an approved shared adapter or edge control and
  configure trusted proxy stripping before horizontal scaling.

### DB-M-01: historical timestamp types are mixed

- **Severity:** Medium.
- **Impact:** much of the original schema uses `TIMESTAMP(3)` while later
  Operations integrity columns use `TIMESTAMPTZ`; UTC interpretation currently
  depends on Prisma/container conventions.
- **Required action:** verify historical timezone assumptions on a staging copy,
  then use an approved forward migration if normalization is required. Do not
  auto-convert without backup and business-time verification.

### OPS-M-03: monitoring and recovery have not been staged

- **Severity:** Medium.
- **Impact:** structured logs exist, but no approved sink/retention, metrics,
  alerting, backup restore rehearsal or incident runbook has been demonstrated.
- **Required action:** complete these staging controls before any production
  decision.

### TOOL-L-01: Prisma package configuration is deprecated

- **Severity:** Low.
- **Impact:** Prisma 6 works but warns that `package.json#prisma` will be removed
  in Prisma 7.
- **Required action:** move seed configuration to `prisma.config.ts` in a
  controlled maintenance change.

### DATA-L-01: legacy local reset-email files remain

- **Severity:** Low, local-only.
- **Impact:** 50 ignored local outbox files predate the fixed cleanup snapshot;
  they contain synthetic/local reset URLs and consume disk.
- **Required action:** a human may inspect and remove `.local-outbox` when the
  old local reset evidence is no longer needed. New integration runs no longer
  increase the count.

### FILE-L-01: local storage has no reconciliation worker

- **Severity:** Low, development/test only.
- **Impact:** an exceptional simultaneous DB compensation and filesystem failure
  can still require manual cleanup.
- **Required action:** production storage needs an approved object-store design,
  malware scanning, lifecycle policy and reconciliation before exposure.

### QA-L-01: browser/device matrix remains narrow

- **Severity:** Low.
- **Impact:** automated E2E currently covers desktop Chromium only; responsive,
  Firefox/WebKit and assistive-technology checks are not automated.
- **Required action:** perform the manual verification below and define the
  staging browser matrix.

## 12. Manual verification still required

1. In a real Git clone, review `git status`, `git log -20`, exact diff, migration
   checksums and secret history; run CI on that commit.
2. Restore a backup into staging, apply all migrations, verify invariant SQL and
   rehearse a forward-fix without reset/drop/truncate.
3. Decide and clean the six legacy fixture namespaces and three slot mismatches
   only after confirming they are disposable test data.
4. Exercise customer checkout/order history, manager payment/assignment/
   reschedule, STAFF denial and technician evidence workflow over staging HTTPS.
5. Verify keyboard, screen-reader labels, mobile layout and Firefox/WebKit for
   the critical UI flows.
6. Configure staging secrets, `NEXTAUTH_URL`/origin, trusted proxy behavior,
   shared rate limiting, structured log sink, retention, metrics and alerts.
7. Obtain written scope approval for the planned warranty/cancellation/role/slot
   modules before changing the release decision.

## 13. Final status

**BLOCKED**

The code and tests for the implemented scope are healthy, with no unresolved
Critical or High finding. Promotion remains blocked until the Medium release
conditions above are resolved or explicitly accepted by authorized humans in a
Git-backed staging process.
