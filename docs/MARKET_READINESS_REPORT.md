# 247 Home Market Readiness Report

> Pre-remediation audit baseline. Execution results and the current release
> decision are recorded in `P0_REMEDIATION_EVIDENCE.md`; this report is retained
> so the original findings remain reviewable.

Audit date: 2026-07-23 (Asia/Bangkok)  
Reviewed revision: `f75cf64` (`feature/auto-update`)  
Scope: current repository source, configuration, migrations, seeded local data,
automated tests, documentation, and local Docker runtime evidence. No
production system, cloud account, secret value, or customer data was accessed.

## 1. Executive Summary

**Market readiness verdict: NOT READY for public production traffic.**

The repository is a mature modular-monolith application: customer storefront,
catalog, cart, checkout, payments, Admin Operations, Technician workflow,
customer warranty, private evidence, and audit logging all have implemented
routes and meaningful automated coverage. The current source passed migration,
lint, strict typecheck, unit, PostgreSQL integration, migration-upgrade, full
Playwright, and production build gates.

That result is not sufficient to call the product production-ready. There are
four High release blockers:

1. `pnpm audit:prod` currently fails on a High advisory for transitive
   `sharp@0.34.5` (`<0.35.0`), inherited through Next.js.
2. The active rate limiter is an in-memory `Map`; repository policy explicitly
   rejects it for every production topology.
3. No current-revision evidence proves an immutable deployed artifact, HTTPS
   ingress, production secret binding, managed PostgreSQL backup/restore,
   private object storage lifecycle, or rollback drill.
4. VNPay code is tested locally but merchant onboarding, public signed IPN,
   sandbox scenarios, reconciliation, and alerts are not yet verified.

No Critical code defect was found in this repository audit. The verdict is
therefore driven by release security, external integration, and operational
readiness rather than by a claim that the core application is non-functional.

## 2. Audit Method and Evidence Limits

- Read and indexed the repository's application, `src/`, Prisma schema and all
  15 migrations, test suites, Docker files, CI workflows, environment
  templates, static assets, infrastructure files, and all Markdown files under
  `docs/`.
- Exercised the canonical local quality gates on the reviewed revision after
  the final migration. Results are recorded in section 7.
- Reviewed actual route, policy, transaction, storage, and test code rather
  than relying only on prior reports.
- Existing reports are historical evidence, not automatically current truth.
  Several older reports predate Warranty and VNPay work and are identified in
  section 9 as stale.
- A manual in-app browser session was unavailable in this audit environment.
  Visual/manual accessibility conclusions are consequently limited to source
  review, committed screenshots, and the freshly-run Playwright suite. This is
  an audit limitation, not a runtime failure.

## 3. Module Completion Status

| Module | Status | Evidence in current source | Remaining limitation / release impact |
| --- | --- | --- | --- |
| Platform and modular monolith | Complete | Next.js App Router, TypeScript strict mode, PostgreSQL/Prisma, Auth.js, Zod, Docker and CI are configured in `package.json`, `app/`, `src/`, and `.github/workflows/ci.yml`. | Production environment has not been proven for this revision. |
| Identity and RBAC | Partial for production | Auth.js server guards, active-user checks, role policy, hashed passwords, reset-token hashes, secure cookie policy, and auth tests are present in `src/modules/identity/` and `src/shared/auth/`. | Production email/reset delivery, MFA or step-up policy, retention policy, and shared rate limiting remain open. See `docs/decisions/ADR-001-identity-local-credentials.md`. |
| Catalog, product images, inventory, service areas | Complete for the implemented vertical slice | Public catalog, product detail, server pagination/filtering, inventory checks, admin catalog routes, service-area checks, and tests exist in `src/modules/catalog/`, `app/api/v1/products/`, and `app/api/v1/admin/`. | Product media uses a valid public fallback manifest when DB `ProductImage` records are absent; production image governance/storage still needs approval. |
| Customer storefront and design system | Complete for current scope | Shared customer route layout, header/footer, product listing/detail, responsive pages, reusable UI primitives, reduced-motion behavior, and customer E2E coverage exist under `app/(customer)/` and `src/components/`. | No browser-engine or assistive-technology matrix is automated. Customer cancellation/reschedule remains deferred by contract. |
| Cart, checkout, order, inventory reservation | Complete for current scope | Server-authoritative quote/checkout, idempotency, inventory and slot locking, order ownership, payment snapshot, and transaction tests are in `src/modules/commerce/`. | No single end-to-end test carries one order continuously through every post-sale role. |
| Payment | Partial | COD/manual payment and a VNPay online lifecycle, signed webhook validation, idempotent session/event handling, optimistic versions, and local E2E tests exist in `src/modules/payment/` and `app/api/v1/payment/`. | Real merchant credentials, public return/IPN URLs, sandbox verification, payment reconciliation/alerting, and approved refund rules are missing. |
| Admin Operations | Partial | Orders, appointments, assignment, reschedule, status actions, audit list, warranty queue, filters and pagination are implemented in `src/components/operations/operations-console.tsx` and `app/api/v1/admin/operations/`. | The warranty queue is read-only in the Admin UI; no complete operational warranty-resolution UI is demonstrated. |
| Technician Portal | Complete for the implemented workflow | Assignment-scoped list/detail, `ASSIGNED -> EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED`, notes, evidence, audit, mobile layout, and IDOR tests are implemented in `src/components/operations/technician-console.tsx` and `app/api/v1/technician/`. | Production evidence storage and device/browser testing remain unvalidated. |
| Customer Warranty and after-sales | Partial | Owner-scoped list/detail/create/evidence/audit, eligibility snapshots, duplicate guard, state policy, and E2E are implemented in `src/modules/warranty/`, `app/api/v1/warranty/`, and `app/(customer)/warranty/`. | Product/legal approval for duration, grace period, PII/evidence retention, malware scanning, and Admin resolution UX are incomplete. |
| Private evidence storage | Partial | MIME, extension, signature and 5 MiB validation; generated keys; authorization before preview; compensation cleanup; local and S3-compatible adapters are in `src/modules/storage/`. | No real production bucket/IAM, malware scanner, retention lifecycle, orphan reconciliation, or restore test is evidenced for the current revision. |
| Observability and health | Partial | Allowlisted JSON HTTP completion logging, request IDs, `/api/health`, and database-backed `/api/ready` exist in `src/shared/observability/logger.ts` and `app/api/`. | There is no verified external log sink, alert policy, RUM/Core Web Vitals, payment reconciliation alarm, or production incident drill. |
| Local demo and release tooling | Partial / production blocked | Docker Compose provides local PostgreSQL, MinIO, a non-root standalone app, health checks, deterministic seed/reset commands, and CI runs the main gates. | `docs/STAGING_VALIDATION_REPORT.md` records that deployed artifact, HTTPS, secrets, DB, storage, and rollback validation are not yet available. |

### Placeholder and demo-data audit

- **Product visual assets:** no missing asset was found for the seeded demo
  product slugs. `public/assets/images/products/` contains 48 PNGs, or four
  views for each of 12 demo product slugs, totaling 5,297,336 bytes. The
  storefront correctly falls back through
  `src/components/catalog/product-demo-images.ts` when an API product has no
  persisted primary image.
- **Database-backed product images:** `prisma/seed.ts` has no `ProductImage`
  seeding. The fallback prevents a customer-facing broken image, but it means
  the Admin-managed product-image persistence path is not demonstrated by the
  default seed.
- **Warranty demo records:** the deterministic seed provides catalog, accounts,
  orders, appointments, assignment, evidence, and audit examples, but does not
  seed a warranty request. Warranty tests create isolated fixtures instead.
- **No fake commerce values were found:** catalog price, SKU, stock, order
  totals, appointment state, and payment state are obtained from the server and
  database. The image fallback is presentation-only.

## 4. End-to-End Flow Assessment

| Flow stage | Automated evidence | Result | Gap |
| --- | --- | --- | --- |
| Customer browse and catalog | `tests/e2e/customer-homepage.spec.ts`, `catalog.spec.ts`, `product-listing.spec.ts`, `product-detail.spec.ts` | PASS | Uses local seeded catalog, not a production content workflow. |
| Cart and checkout | `tests/e2e/cart.spec.ts`, `checkout.spec.ts`; PostgreSQL checkout concurrency tests | PASS | Customer cancellation and self-service reschedule are intentionally deferred. |
| Payment | `tests/e2e/payment-flow.spec.ts`, `payment-workflow.spec.ts`, `tests/integration/payment.test.ts` | PASS locally | The provider leg is simulated by signed test webhook data; it is not a merchant sandbox certification. |
| Admin payment, assignment, reschedule and audit | `tests/e2e/admin-operations-dashboard.spec.ts`, `operations-assignment.spec.ts`, `operations-reschedule.spec.ts` | PASS | Warranty resolution remains read-only in the Admin UI. |
| Technician workflow and evidence | `tests/e2e/operations-technician-workflow.spec.ts`, `technician-jobs.spec.ts`, `operations-idor.spec.ts` | PASS | No physical mobile-device/browser-engine coverage. |
| Customer warranty | `tests/e2e/customer-warranty.spec.ts`; warranty integration and policy tests | PASS | No seeded warranty queue; no full Admin resolution journey. |

The required role flows are covered as separate independent E2E journeys. No
single Playwright scenario was found that creates one order and follows that
same record through payment, Admin, Technician completion, and warranty creation.
That is a regression-coverage gap, not evidence that the individual steps fail.

## 5. UX and UI Evaluation

### Strengths

- The UI uses a consistent token-based design system in `app/globals.css` and
  `src/components/ui/`, with shared customer, admin, technician, and auth
  layouts.
- Responsive E2E exercises 390 px, 768 px, and 1440 px storefront layouts;
  separate tests cover Admin responsive boundaries and Technician portrait and
  landscape workflows. Tests assert no horizontal overflow where appropriate.
- Motion is lightweight: CSS opacity/transform transitions and a one-shot
  `IntersectionObserver` reveal implementation in `src/components/motion/reveal.tsx`.
  `prefers-reduced-motion` is honored and has E2E coverage.
- Forms expose labels, error states, disabled/loading controls, and focus
  styling. Navigation, headings, `alt` text, dialog semantics, and selected
  state are broadly represented in source; user-provided notes are rendered as
  text rather than injected HTML.
- Empty, loading, error, confirmation, pagination, and conflict states exist
  in the customer, Operations, and Technician experiences.

### UX/accessibility gaps

1. No automated axe, screen-reader, keyboard-tab-order, color-contrast, or
   multi-browser accessibility suite is configured. Current Playwright runs one
   Chromium project, even though it exercises narrow viewports.
2. Manual visual QA on a real login, device, keyboard, and assistive technology
   session is still required before public launch.
3. The Admin warranty queue is informational/read-only, so staff cannot finish
   an end-user warranty resolution from the product UI.
4. The default demo has no persisted `ProductImage` rows and no warranty
   request, reducing the quality of manual Admin image and warranty demos.

## 6. Security Assessment

### Verified controls

- **Role and ownership enforcement:** server guards use Auth.js session actor
  data and active-user/role checks. Customer orders and warranties are
  owner-scoped; technician access is assignment-scoped; manager/admin policies
  gate Operations actions. Direct-access denials are covered in
  `tests/e2e/customer-orders.spec.ts`, `operations-idor.spec.ts`,
  `operations-staff-ui.spec.ts`, and warranty integration tests.
- **Server-authoritative money and state:** checkout recomputes price and
  totals; order/payment/appointment/warranty mutations use state policies,
  transactions, row locks, conditional updates, and `expectedVersion` guards.
  PostgreSQL integration tests cover races, inventory, scheduling conflicts,
  and audit effects.
- **Replay and duplicate controls:** checkout, warranty creation, payment
  session/webhook processing, order transitions, assignment, reschedule, and
  technician actions have idempotency or optimistic-concurrency coverage.
- **Mutation boundary:** `src/shared/http/api-handler.ts` validates allowed
  origin, required JSON content type, bounded request body, process-local rate
  limit, structured error responses, request IDs, and private/no-store cache
  responses for sensitive handlers.
- **Evidence handling:** `src/modules/storage/evidence-validation.ts` allows
  only JPEG/PNG/WebP, verifies filename, extension, file signature, size, and
  generated namespace key. Preview checks authorization before download; storage
  keys and physical paths are not returned in customer/technician DTOs.
- **Browser/server hardening:** `next.config.ts` includes a CSP, no-sniff,
  anti-framing, referrer, permissions-policy headers, and disables the powered
  by header. Secure cookies are enforced in production mode by
  `src/shared/validation/env.ts`.

### Security release gaps

| ID | Severity | Finding and impact | Required closure |
| --- | --- | --- | --- |
| SEC-H-01 | High | The active limiter is process-local (`src/modules/identity/infrastructure/rate-limiter.ts`). `docs/RATE_LIMITING_STRATEGY.md` explicitly states it is not approved for production. Multiple instances or restarts evade shared quotas; trusted proxy behavior also needs verification. | Add an approved shared/edge limiter, define outage behavior, configure trusted proxy/header stripping, and prove multi-instance rate-limit behavior. |
| SEC-M-01 | Medium | Production CSP contains `script-src 'self' 'unsafe-inline'` in `next.config.ts`. React escaping and the absence of `dangerouslySetInnerHTML` reduce exposure, but this weakens CSP as an XSS containment layer. | Design and validate a Next.js-compatible nonce/hash CSP or formally accept the residual risk after security review. |
| SEC-M-02 | Medium | Production password-reset delivery, MFA/step-up for privileged users, retention, and recovery policy are unresolved. The local filesystem reset mailer is deliberately unavailable in production. | Approve and test a production mailer/provider, privileged-account recovery/MFA policy, retention, and incident process. |
| SEC-M-03 | Medium | Evidence validates type and size but has no malware scanning, retention lifecycle, or production-object-storage evidence. | Bind private storage/IAM, scan on upload or quarantine, define retention/deletion, and run lifecycle/recovery tests. |
| SEC-M-04 | Medium | Warranty duration, calendar/grace-period policy, and PII/audit retention lack Product/Legal approval. | Approve policy and encode/verify the resulting retention/expiry rules before public after-sales use. |

## 7. Test and Quality-Gate Results

These commands were run on the reviewed repository state after the latest
migration. `pnpm test:e2e` was a fresh 47-test run using the current Playwright
configuration (one worker, no configured retry, traces retained and screenshots
captured only on failure).

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm db:migrate` | PASS | 15 migrations found; no pending migration. |
| `pnpm lint` | PASS | ESLint completed with `--max-warnings=0`. |
| `pnpm typecheck` | PASS | Strict `tsc --noEmit` completed. |
| `pnpm test` | PASS | 27 files, 95 tests. |
| `pnpm test:integration` | PASS | 10 PostgreSQL integration files, 68 tests. |
| `pnpm test:migration` | PASS | Current valid-history upgrade and invalid-history rejection/rollback passed. |
| `pnpm test:e2e` | PASS | 47/47 Playwright tests on a fresh server after migration. |
| `pnpm build` | PASS | Next.js 16.2.10 production build completed. |
| `pnpm format:check` | **FAIL** | Prettier reports style drift in 86 files. This is not in CI today, but it is a failed repository quality command. |
| `pnpm audit:prod` | **FAIL / High** | `sharp@0.34.5` is vulnerable to advisory GHSA-f88m-g3jw-g9cj (four listed libvips CVEs; affected `<0.35.0`). |

The CI workflow runs `pnpm audit:prod` before migration and test gates.
Therefore the currently configured CI pipeline will fail until the dependency
advisory is resolved or an explicitly approved exception mechanism is added.

### Test coverage observations

- Good coverage exists for authorization/IDOR, price and total tampering,
  transaction rollback, inventory and slot concurrency, order/payment versions,
  audit insertion, storage cleanup, migration upgrades, pagination, cache
  headers, responsive layouts, and reduced motion.
- The suite has no test retry configured; it does not use timeout padding as a
  way to hide flaky behavior.
- Missing coverage is primarily production-system validation: live VNPay
  sandbox, managed-object-storage lifecycle, TLS/secure-cookie behavior through
  real ingress, backup/restore for the 15-migration schema, alert delivery,
  load/soak, real browser engines, and an all-roles continuous business journey.

## 8. Performance Assessment

### Positive evidence

- Next.js `Image` is used for product, hero, authentication, warranty, and
  technician images; responsive `sizes` are supplied where product cards and
  galleries render.
- Product images are modestly sized for the current demo set: 48 local PNGs
  total 5.30 MB; the largest is about 211 KB.
- Lists use pagination/cursors and bounded limits rather than loading entire
  operational datasets at once.
- Motion uses transform/opacity, respects reduced motion, and avoids parallax,
  autoplay loops, and continuously animated decoration.

### Gaps and findings

| ID | Severity | Finding | Recommended action |
| --- | --- | --- | --- |
| PERF-M-01 | Medium | The fresh Playwright run emitted Next.js LCP warnings for above-the-fold catalog images such as `khoa-cua-l2.png`, `khoa-cua-l1.png`, and `mesh-wifi-m3.png`. `ProductCard` has responsive `sizes` but no controlled priority strategy. | Prioritize only the truly above-the-fold first card/hero image, measure LCP, and avoid making every list image eager. |
| PERF-M-02 | Medium | There is no current Lighthouse/Web Vitals/RUM budget, API load test, database query-plan baseline, or multi-user soak result. | Establish mobile/desktop LCP/INP/CLS and server latency/error budgets, then test the target deployment before launch. |
| PERF-M-03 | Low | The demo image fallback is static and effective, but it is a 5.3 MB source asset set rather than a measured CDN/image-optimization strategy. | Use the final storage/CDN design, responsive formats, cache policy, and real-device measurements before broader traffic. |

## 9. Documentation and Release-Operations Assessment

### Strengths

- Architecture, database, API, threat model, local demo runbook, state-machine,
  release, migration, staging, cloud, and module reports are unusually thorough.
- `Dockerfile` and `docker-compose.yml` provide a defensively configured local
  demo: non-root runtime, read-only filesystem, dropped capabilities, health
  checks, PostgreSQL, and private MinIO.
- Environment templates keep production values blank and `.gitignore` excludes
  local `.env` files, build output, caches, and local uploads.

### Documentation defects and external release blockers

| ID | Severity | Finding | Evidence / action |
| --- | --- | --- | --- |
| DOC-H-01 | High | The primary README, MVP scope freeze, Definition of Done, and older staging reports contradict current code. They still call customer Warranty and VNPay deferred/not planned even though current routes, migration 15, tests, and ADR-014 implement them. | Update canonical README/scope/DoD/API/release records; preserve historical reports but mark them superseded with date/revision. Human product/security approval is required for this scope change. |
| OPS-H-01 | High | There is no current-revision production or real-staging validation. Existing `docs/STAGING_VALIDATION_REPORT.md` declares staging blocked for immutable artifact, HTTPS, secret manager, DB, storage, and rollback evidence; it predates later migrations and payment work. | Deploy only to a controlled staging environment, record exact image digest/SHA, validate HTTPS/headers/cookies, run migration/backup/restore, real S3 evidence lifecycle, smoke flows, and rollback. |
| OPS-H-02 | High | Online payment is externally incomplete. `docs/PAYMENT_IMPLEMENTATION_REPORT.md` requires separate merchant credentials, public HTTPS callback registration, success/failure/duplicate/delayed sandbox scenarios, distributed limiting, and reconciliation/alerts. | Keep VNPay unavailable in production until the checklist passes and finance/security approve operation and refund/reconciliation policy. |
| DOC-M-01 | Medium | `pnpm format:check` fails in 86 files and CI does not enforce it. Old reports also record obsolete test counts, migrations, and status. | Format intentionally, add a formatter gate to CI after a clean baseline, and publish a revision-indexed current release report. |
| OPS-M-01 | Medium | Structured HTTP JSON logs exist, but no verified log sink, alert routes, owner/on-call policy, or dashboard is configured. | Bind stdout to a managed sink, redact-review fields, alert on 5xx/429/readiness/payment aging, and test an alert. |

## 10. Risk Register

| Risk | Impact | Probability | Mitigation | Release position |
| --- | --- | --- | --- | --- |
| Vulnerable transitive `sharp` release dependency | Security patch exposure and failing CI | High until updated | Upgrade/rebase the compatible Next.js/sharp dependency path; rerun all gates and audit | Blocker |
| Process-local rate limits in public or scaled runtime | Brute force and mutation abuse can bypass quota | High | Shared/edge limiter, trusted proxy configuration, outage tests | Blocker |
| Unverified VNPay callbacks/reconciliation | Incorrect payment state or missed provider event | Medium/High | Sandbox certification, public callback, reconciliation/alerts, business approval | Blocker when online payment is enabled |
| No real staging/production recovery proof | Failed deployment, loss of service, unknown restore time | Medium | Immutable artifact, managed DB/S3, encrypted backup, restore and rollback drills | Blocker |
| Stale scope/release documentation | Wrong operational decision or unsafe enablement | High | Reconcile canonical docs and obtain human approval | Blocker |
| No malware scan/retention policy for evidence | Unsafe file retention and privacy/compliance exposure | Medium | Quarantine/scanning, lifecycle, legal retention policy | Blocker for public evidence uploads |
| Insufficient live performance/accessibility data | Poor mobile experience or inaccessible critical flow | Medium | Web Vitals/RUM, load test, axe/manual/AT/browser matrix | Conditional launch gate |
| Customer cancellation, customer reschedule, refund, and Admin warranty resolution not complete | Support staff must handle cases outside the product UI | Medium | Either formally retain as product scope exclusions with support playbook, or implement/test them | Product launch decision |

## 11. Recommended Release Plan

### P0: must close before public traffic

1. Resolve the High `sharp` advisory without bypassing `pnpm audit:prod`; lock
   the new dependency tree and rerun migration, lint, typecheck, unit,
   integration, E2E, build, and audit.
2. Replace the in-memory production limiter with a reviewed shared/edge
   implementation. Verify client-IP handling at the ingress and test two
   application instances.
3. Establish a non-production staging environment that uses an immutable image,
   canonical HTTPS URL, managed PostgreSQL, private object storage, secret
   manager, health/readiness checks, structured-log sink, and alerts.
4. Back up and restore the database for the exact 15-migration revision; test
   application rollback with a retained compatible artifact. Do not use reset,
   destructive rollback, or a local demo database as proof.
5. Complete VNPay merchant sandbox onboarding and validate signed IPN/return,
   success, cancellation/failure, duplicate callback, delayed callback, aging
   reconciliation, and alert paths. Keep online payment disabled until then.
6. Reconcile canonical scope documents with ADR-014/Warranty implementation and
   obtain Product, Security, Finance, and Legal sign-off for payment, warranty,
   PII/evidence retention, malware scanning, and privileged access policies.

### P1: required for a controlled pilot

1. Seed one warranty request and persisted `ProductImage` records, or document
   why the static fallback is the chosen launch behavior.
2. Add a full cross-role E2E journey from order creation through payment,
   assignment, installation completion, and warranty creation.
3. Clean the 86 Prettier violations and add `pnpm format:check` to CI.
4. Add Web Vitals/Lighthouse and server-load budgets, plus production dashboard
   and alert verification.
5. Add automated accessibility scanning and manual keyboard, contrast,
   screen-reader, mobile-device, Firefox, and WebKit sign-off.
6. Address the LCP warning with a measured, selective priority strategy for the
   actual above-the-fold catalog image.

## 12. Final Recommendation

Do **not** deploy 247 Home as a public market-facing production service from
the reviewed revision. The application is feature-rich and locally
demonstrable, and its core transactional/security tests are in good shape, but
the High release blockers make a public launch premature.

The appropriate next state is **controlled staging remediation**: close P0,
prove the external runtime and payment boundaries, then repeat this audit on the
immutable deployed revision. Only after the dependency audit, shared rate
limiting, production/staging recovery evidence, VNPay validation, and canonical
scope approval are all closed should the verdict be reconsidered as
**CONDITIONAL READY** or **READY**.
