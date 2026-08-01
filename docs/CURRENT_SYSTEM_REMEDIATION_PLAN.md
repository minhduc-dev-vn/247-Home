# Current System Remediation Plan

**Source audit:** [`CURRENT_SYSTEM_AUDIT_REPORT.md`](CURRENT_SYSTEM_AUDIT_REPORT.md)
**Plan date:** 2026-07-28
**Target outcome:** a reproducible, database-ready Render staging release candidate; not an automatic production deployment.

## 1. Decision and Scope

The recommended remediation path is:

1. Stabilize and verify one reviewed release branch.
2. Prove the deployed Render revision, database readiness, and diagnostics.
3. Fix Critical application invariants before enabling public traffic or online payment.
4. Verify all PostgreSQL-backed gates from a clean, repeatable local/staging environment.
5. Promote only an exact reviewed Git commit after explicit human approval.

This plan covers the two Critical, six High, and seven Medium findings in the current audit. It does not reset databases, run production migrations, deploy a service, rotate a credential, change payment credentials, or seed an external database. Those are human-approved operations and must be performed in the designated provider console or approved release workflow.

## 2. Immediate Containment - Before Code Changes

| Priority | Action | Owner | Evidence required | Exit criterion |
| --- | --- | --- | --- | --- |
| P0-01 | Rotate the database credential exposed during support; update only the Render secret variable. | Database owner | Provider rotation timestamp, redacted Render variable update, connection audit review | Old credential cannot connect. |
| P0-02 | Pause public registration/payment testing until the deployed revision and database health are known. | Release owner | Render service status and maintenance decision | No unverified public mutation testing continues. |
| P0-03 | Capture one failing registration request: URL, HTTP status, response request ID, and matching Render log line. | Release owner | Redacted browser/network capture and log entry | Failure has a concrete server-side cause. |
| P0-04 | Identify Render selected branch and deployed commit SHA. | Release owner | Render deploy log and service settings screenshot/export | SHA is known and matched against Git. |
| P0-05 | Change Render health monitoring from `/api/health` to `/api/ready`; test both success and database-unavailable response in staging. | Release owner | Redacted service setting, `/api/ready` 200 and controlled 503 evidence | Database outage cannot appear healthy. |

**Safety rules:** do not put a connection string in a document, shell history, GitHub issue, or screenshot; do not manually insert missing roles before migration state is confirmed; do not run `migrate reset`, `DROP`, or truncate commands.

## 3. Phase 1 - Establish a Reproducible Release Baseline

### Goal

Make one reviewed commit the only candidate for deployment. The current dirty worktree is not a release artifact.

### Actions

1. Review the 21 modified and 5 untracked current worktree items as a bounded remediation change set.
2. Separate unrelated UI/query-schema changes from registration, health, and test fixes if they cannot be verified together.
3. Reconcile `feature/auto-update` with `main` through a normal reviewed merge or pull request. Do not force-push or overwrite history.
4. Verify the release branch includes both:
   - `20260722120000_online_payment_vnpay`;
   - `20260726120000_identity_role_reference_data`.
5. Commit only reviewed source, tests, migration files, and documentation. Exclude `.env`, build output, test traces, cache, and provider logs containing secrets.
6. Configure Render to build and deploy the protected release branch, then record the deployed Git SHA in a revision-specific release record.

### Expected files

| Area | Expected files |
| --- | --- |
| Deployment definition | `render.yaml` if the team elects to codify Render settings, otherwise a documented Render settings record in `docs/RENDER_STAGING_RUNBOOK.md` |
| Release record | `docs/RENDER_STAGING_RELEASE_RECORD.md` (new) |
| Existing runbook | `docs/RENDER_STAGING_RUNBOOK.md` |
| CI quality gate | `.github/workflows/ci.yml` |

### Acceptance criteria

- The deployed SHA is visible in Render and matches the reviewed Git commit.
- The deployment uses the correct migration history without manual database edits.
- A rollback target SHA is recorded before enabling traffic.
- The service reports a revision identifier that operators can correlate with logs.

## 4. Phase 2 - Resolve Registration and Password-Recovery Reliability

### 4.1 Registration diagnosis and release fix

The public registration message is deliberately generic. The server-side cause must be captured through a request ID rather than exposed to customers.

#### Investigation order

1. Confirm deployed SHA and role-reference migration status.
2. Call the deployed `/api/ready`; stop if it is not HTTP 200.
3. Compare exact scheme/host of the browser origin with `NEXTAUTH_URL` and `APP_ORIGIN` in Render settings. Use variable names/status only, never values in logs.
4. Reproduce registration once with a fresh test email and correlate the request ID to Render logs.
5. Classify the outcome as database connectivity, missing role data, origin rejection, validation, duplicate email, or unexpected application error.

#### Remediation surface

| File / area | Planned change |
| --- | --- |
| `src/modules/identity/application/identity-service.ts` | Keep registration transactional; return structured domain errors without exposing account existence. |
| `src/modules/identity/infrastructure/user-repository.ts` | Preserve the idempotent role-reference lookup/self-heal only if migration-state policy approves it. |
| `app/api/v1/auth/register/route.ts` | Preserve request-ID correlation and map known failures to stable safe responses. |
| `tests/integration/identity.test.ts` | Add PostgreSQL integration cases for missing reference role, duplicate request, origin rejection, and database error mapping. |
| `tests/e2e/registration.spec.ts` | Verify a fresh customer registration against the final deployed contract. |
| `docs/API_CONTRACT.md` | Document safe error envelopes and request-ID support. |

The current proposed password minimum of 8 characters is a separate product/security policy decision. Review it explicitly, document its rationale, and do not describe it as a registration outage fix.

### 4.2 Critical password-reset remediation

#### Required design

- Replace the production-throwing local mailer with a production mail/outbox implementation selected and approved by the team.
- Return the same accepted response for existing, unknown, and inactive emails.
- Do not persist an active reset token if the accepted delivery/outbox operation cannot be guaranteed; alternatively record a durable outbox event in the same transaction and deliver asynchronously.
- Do not log reset tokens, password values, or email content.
- Expire, hash, and consume tokens only under the existing server-authoritative policy.

#### Expected files

| File / area | Planned change |
| --- | --- |
| `src/modules/identity/infrastructure/local-password-reset-mailer.ts` | Limit local adapter to development/test or replace through a mailer port. |
| `src/modules/identity/application/identity-service.ts` | Make token/outbox lifecycle atomic and enumeration-resistant. |
| `app/api/v1/auth/forgot-password/route.ts` | Use structured error logging with request ID while always returning the approved public response. |
| `app/api/v1/auth/reset-password/route.ts` | Route unexpected failures through the shared safe logger. |
| `tests/unit/**/password-reset*.test.ts` | Test state-machine/token behavior and unknown-email equivalence. |
| `tests/integration/identity.test.ts` | Test production-mode adapter failure behavior, transaction rollback/outbox behavior, and no enumeration. |
| `docs/SECURITY_INCIDENT_AND_RECOVERY.md` (new) | Describe reset-mail outage and credential-rotation operational response. |

#### Acceptance criteria

- Known and unknown email requests have the same public status/body/timing tolerance.
- Production reset requests do not return 500 merely because a local-only mailer is selected.
- Failed durable delivery cannot leave a usable undelivered reset token.
- Unit, integration, and E2E tests cover the final behavior.

## 5. Phase 3 - Repair Order Cancellation, Expiry, and Inventory Release

### Goal

Ensure an order that never completes payment cannot permanently consume inventory or appointment capacity.

### Required business-policy decision

Before implementation, Product/Operations must approve:

- which statuses can be cancelled or expired;
- who may cancel each status;
- when unpaid orders expire;
- whether a slot remains held after manual-bank-transfer selection;
- customer notification policy;
- whether released stock can be re-reserved by a retry.

This cannot be inferred safely because it affects inventory, schedules, customer promises, and payment handling.

### Implementation design constraints

1. Define cancellation/expiration as a centralized server-side order-transition policy, not a UI-only state change.
2. In one PostgreSQL transaction and in deterministic resource order:
   - conditionally update the order using ID, current status, and expected version;
   - transition each reservation from `RESERVED` to `RELEASED` exactly once;
   - decrement/release appointment slot capacity exactly once;
   - create one audit event with actor/reason/request ID;
   - rollback every write if any reservation/slot/audit step fails.
3. Use a bounded scheduler/worker or explicitly approved maintenance action for expiry. It must be idempotent and must not perform network calls inside the database transaction.
4. Do not release inventory for a paid order without an approved refund/fulfilment policy.

### Expected files

| File / area | Planned change |
| --- | --- |
| `src/modules/commerce/domain/order-transition.ts` | Add approved cancel/expire actions, allowed source states, and side-effect declarations. |
| `src/modules/commerce/application/commerce-service.ts` | Orchestrate conditional transition, stock release, slot release, and audit in one transaction. |
| `src/modules/commerce/infrastructure/*` | Add narrowly scoped conditional reservation/slot release persistence methods if needed. |
| `app/api/v1/orders/[id]/*` or approved job entry point | Expose only authorized server intent; do not accept client-calculated stock/state. |
| `tests/integration/order-transitions.test.ts` | PostgreSQL concurrency, rollback, retry, audit, and no-negative-inventory cases. |
| `tests/e2e/*checkout*` | Customer-visible expired/cancelled order behavior after policy approval. |
| `docs/ORDER_STATE_MACHINE.md` | Update state graph, transition table, inventory/slot effects, and rollback note. |
| `docs/DATABASE_RUNBOOK.md` | Add safe expiry/recovery operational procedure. |

### Acceptance criteria

- Exactly one concurrent cancel/expire transition succeeds for a given expected version.
- Reservation/slot release is exactly-once and leaves no negative quantities.
- A failed release/audit rolls back the order transition.
- Paid orders cannot be released through an unpaid-order path.
- PostgreSQL integration tests prove the behavior.

## 6. Phase 4 - Contain and Qualify VNPay Payment Flow

### Immediate policy

Keep VNPay unavailable to public users until sandbox qualification is completed. The UI should not expose an unqualified online-payment option. This is an operational gate, not a change to order pricing or customer business rules.

### Required fixes

1. Enforce one unexpired active provider payment session for one payment/order.
2. Expire or reject the prior pending session before issuing a replacement.
3. Treat a second provider transaction for a paid order as a reconciliation exception, not a silent duplicate.
4. Retain signed-IPN idempotency and ensure every callback validates signature, order reference, amount, currency, and current payment state.
5. Provide a read-only reconciliation report for stale/duplicate/mismatched sessions. Do not automate refunds or order correction without approved policy.

### Expected files

| File / area | Planned change |
| --- | --- |
| `src/modules/payment/domain/payment-lifecycle.ts` | Define active-session and expiration invariants. |
| `src/modules/payment/application/payment-service.ts` | Enforce the invariant transactionally and create auditable reconciliation exceptions. |
| `app/api/v1/payment/webhook/route.ts` | Match the documented provider response contract and retain safe structured diagnostics. |
| `scripts/payment-reconciliation-report.ts` (new) | Bounded read-only reconciliation, with no secret output. |
| `tests/integration/payment-*.test.ts` | Concurrency, multiple-key, duplicate-IPN, amount/reference mismatch, and rollback cases on PostgreSQL. |
| `docs/VNPAY_SANDBOX_VALIDATION.md` (new) | Evidence matrix for signed real sandbox scenarios. |
| `docs/PAYMENT_RECONCILIATION_RUNBOOK.md` (new) | Ownership, cadence, alerts, and manual exception handling. |

### Acceptance criteria

- Two session-create requests cannot yield two simultaneously payable links for one payment.
- Duplicate IPN creates no additional order transition/audit event.
- Successful, cancelled, delayed, duplicate, tampered, mismatched, and provider-outage sandbox cases are recorded.
- Finance, Security, and Operations sign off before public enablement.

## 7. Phase 5 - Restore Reliable Catalog Media and Catalog Availability

### Product-image architecture

Static assets under `public/assets/images/products/` are suitable for tracked demo imagery. Persisted `ProductImage` records, however, cannot rely on local filesystem storage in a Render production container.

### Actions

1. Verify a deployed static asset directly by URL, including status, `Content-Type`, cache header, and release SHA.
2. Determine whether missing product cards refer to a static asset or a persisted `ProductImage` record.
3. For persisted media, implement an approved S3-compatible object-storage adapter with private storage, generated authorized preview URLs/endpoints, MIME/extension/size checks, and cleanup compensation.
4. Store logical object keys only; never expose physical paths or accept arbitrary path input.
5. Create an approved, non-destructive migration plan for existing image rows. Do not seed or replace production catalog data without a catalog owner decision.
6. Make catalog population an explicit staging/demo seed operation, never an incidental effect of `prisma migrate deploy`.

### Expected files

| File / area | Planned change |
| --- | --- |
| `src/modules/catalog/infrastructure/local-image-storage.ts` | Restrict to local development/test. |
| `src/modules/catalog/infrastructure/*object-storage*.ts` (new) | Production S3-compatible storage implementation. |
| `src/modules/catalog/application/*` | Preserve server-side metadata validation and cleanup boundary. |
| `app/api/v1/product-images/[id]/route.ts` | Authorize and serve/redirect through the approved adapter without physical paths. |
| `tests/integration/*product-image*.test.ts` | MIME, size, path traversal, authorization, and failed-write cleanup. |
| `tests/e2e/*catalog*.spec.ts` | Product image display from actual supported paths. |
| `prisma/seed.ts` | Keep demo seed explicit and idempotent; do not execute against production. |
| `docs/OBJECT_STORAGE_RUNBOOK.md` | Add provider config, lifecycle, recovery, and media migration procedure. |

### Acceptance criteria

- A static image and a persisted image both render after a clean deploy.
- Unauthorized media preview is denied.
- Failed database/object operations leave no orphan object.
- No product image path/credential is exposed through the API.

## 8. Phase 6 - Verify Rate Limiting and Ingress Trust

### Goal

Make rate limiting real for the actual hosting topology, rather than relying on in-process memory or an undocumented upstream assumption.

### Actions

1. Choose and record one production control: a provider-managed edge/WAF rate limit or an approved shared store. For Render, the choice must be supported by the selected Render plan and external ingress topology.
2. Restrict direct-origin traffic if a proxy/edge is authoritative.
3. Configure trusted proxy headers only after provider documentation/evidence proves header overwriting behavior.
4. Perform a bounded staging probe from controlled test addresses against login, registration, forgot-password, and mutation endpoints.
5. Record 429 behavior, recovery window, client-address behavior, and application/provider logs without logging credentials or PII.

### Expected files

| File / area | Planned change |
| --- | --- |
| `src/modules/identity/infrastructure/rate-limiter.ts` | Keep only an adapter whose operational enforcement is verified. |
| `src/shared/http/client-address.ts` | Narrow trust to approved proxy topology; fail closed when not verified. |
| `render.yaml` or provider configuration record | Codify/record ingress and throttling settings. |
| `tests/integration/*rate-limit*.test.ts` | Contract tests for 429/error envelopes and non-bypass behavior. |
| `scripts/verify-staging-rate-limit.ts` (new) | Controlled, bounded smoke probe. |
| `docs/RATE_LIMITING_RUNBOOK.md` (new) | Thresholds, alerts, exceptions, and evidence. |

### Acceptance criteria

- Multi-instance/edge behavior is demonstrated in staging, including 429.
- Spoofed forwarded client addresses cannot choose another user's limiter bucket.
- Login/register/forgot-password/mutations retain expected safe error contracts.

### Repository execution status - 2026-08-01

Repository remediation is complete and recorded in
[`PHASE_6_EXECUTION_REPORT.md`](PHASE_6_EXECUTION_REPORT.md). The application
now trusts a client address only through the CloudFront overwrite contract;
the single-instance Render staging exception fails closed to an untrusted common
bucket and no longer reads `X-Forwarded-For`. The bounded probe, static ingress
checks, and HTTP-contract tests are implemented and all local migration, lint,
typecheck, unit, integration, E2E, and build gates passed.

The acceptance criteria above remain **pending owner-run AWS staging evidence**:
CloudFront/WAF must be in block mode, the origin must be confirmed inaccessible,
two ECS tasks must be observed, and the bounded probes must record 429 plus
redacted WAF/CloudWatch evidence. No AWS account, approved staging URL, Web ACL
access, or release-owner approval was available in this checkout. Do not mark
H-04 closed from repository tests alone.

## 9. Phase 7 - Quality Gates, Documentation, and Operational Evidence

### Required actions

1. Restore local Docker/PostgreSQL availability without deleting existing volumes or data.
2. From the final clean release commit, run all canonical gates:

```powershell
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm test:integration
pnpm test:migration
pnpm test:e2e
pnpm build
```

3. Fix the existing formatting baseline or formally separate it into an approved cleanup change; add `pnpm format:check` to CI before release.
4. Update documentation so every readiness claim carries a reviewed commit/date and a command/log/evidence link.
5. Preserve historical reports; add a new release record rather than overwriting them.

### Documentation updates

| Document | Required update |
| --- | --- |
| `README.md` | Actual supported modules, setup, seed boundaries, and known production limits. |
| `docs/THREAT_MODEL.md` | Align payment/cloud/media scope with implemented code. |
| `docs/API_CONTRACT.md` | Registration diagnostics envelope, password-reset contract, payment IPN contract, and version/conflict behavior. |
| `docs/ORDER_STATE_MACHINE.md` | Approved cancellation/expiry/release transitions. |
| `docs/RENDER_STAGING_RUNBOOK.md` | Release branch/SHA, `/api/ready`, secret handling, seed policy, rollback, and evidence procedure. |
| `docs/CURRENT_SYSTEM_AUDIT_REPORT.md` | Link to final remediation evidence after it is genuinely complete. |
| `docs/RELEASE_READINESS_RECORD.md` (new) | Exact SHA, migration status, command outputs, Render evidence, approvers, and residual risks. |

### Acceptance criteria

- No gate is reported PASS unless it ran after the final migration and final UI/API code change.
- CI fails on lint, typecheck, unit, integration, E2E, build, dependency audit, and formatting.
- A release reviewer can reproduce the deployed service from one Git SHA and documented Render configuration.

### Repository execution status - 2026-08-01

The repository/local part of Phase 7 is complete and is recorded in
[`PHASE_7_EXECUTION_REPORT.md`](PHASE_7_EXECUTION_REPORT.md) and
[`RELEASE_READINESS_RECORD.md`](RELEASE_READINESS_RECORD.md). Local Docker
PostgreSQL and MinIO were retained, `prisma migrate deploy` reported no pending
migration, the idempotent development seed completed, and the full current
quality suite passed. CI now enforces `pnpm format:check`, and Prisma now uses
`prisma.config.ts` rather than the deprecated package-level configuration.

This is deliberately **not** a claim of an immutable release artifact or a
deployed service. The checked worktree contains remediation changes that were
not automatically committed by this task. A release owner must review, commit,
tag, and rerun the canonical gates from that immutable commit before a release
review can use the final acceptance criterion. AWS/CloudFront/WAF and other
provider evidence are deferred by owner request and remain external gates.

## 10. Finding-to-Plan Matrix

| Audit finding | Remediation phase | Required proof | Status now |
| --- | --- | --- | --- |
| C-01 Password reset enumeration/outage | Phase 2.2 | Equal responses, transactional/outbox test, production adapter test | OPEN |
| C-02 Inventory/slot never released | Phase 3 | PostgreSQL concurrency/rollback/retry tests | OPEN |
| H-01 Branch/deployment drift | Phases 1 and 2.1 | Render SHA equals reviewed release SHA | OPEN |
| H-02 Liveness misreported as readiness | P0-05 and Phase 1 | `/api/ready` health configuration and 503 drill | OPEN |
| H-03 Multiple active VNPay sessions | Phase 4 | One-active-session concurrency + sandbox matrix | OPEN |
| H-04 Unverified distributed limiter | Phase 6 | Staging 429 and trusted-proxy evidence | REPOSITORY HARDENED; LIVE AWS STAGING EVIDENCE PENDING OWNER |
| H-05 Production product-media failure | Phase 5 | Static/persisted image deploy + authorization test | REPOSITORY FIXED; REAL STAGING PROVIDER EVIDENCE PENDING OWNER |
| H-06 Exposed database credential | P0-01 | Rotation and old-credential invalidation | OPEN |
| M-01 Unverified DB/E2E gates | Phase 7 | Fresh canonical gate results | REPOSITORY VERIFIED; immutable release/deploy evidence pending owner |
| M-02 Format gate omitted | Phase 7 | `format:check` green and required by CI | FIXED IN REPOSITORY/CI |
| M-03 Stale documentation | Phase 7 | Revision-specific canonical docs | FIXED FOR CURRENT RECORD; historical reports retained |
| M-04 Catalog seed ambiguity | Phase 5 / Phase 7 | Explicit non-destructive seed policy | PHASE 5 POLICY IMPLEMENTED; RELEASE-OWNER APPROVAL PENDING |
| M-05 Reset diagnostics gap | Phase 2.2 | Request-ID logging regression test | OPEN |
| M-06 IPN contract unverified | Phase 4 | Sandbox and reconciliation evidence | OPEN |
| M-07 Prisma config deprecation | Phase 7 | Planned `prisma.config.ts` migration before Prisma 7 | FIXED; `prisma.config.ts` is the canonical Prisma CLI configuration |

## 11. Release Sequence and Rollback

### Staging sequence

1. Take a provider-managed snapshot/back-up according to the database runbook.
2. Deploy the reviewed release SHA to staging.
3. Run `prisma migrate deploy` only through the approved staging release procedure.
4. Verify migration status and `/api/ready`.
5. Run seed only for an explicitly marked demo/staging database, using an idempotent command and no production credentials.
6. Execute full test gates and the manual evidence matrix.
7. Publish the release record and obtain approvals.

### Rollback sequence

1. Stop traffic promotion and record incident/request IDs.
2. Roll back Render to the previously recorded, known-good Git SHA.
3. Do not roll back a database schema by destructive commands. Use a reviewed forward-fix migration when data compatibility is uncertain.
4. Restore from backup only under the database runbook with named owner approval.
5. Re-run `/api/ready`, application smoke checks, and audit/inventory invariants.

## 12. Human Approvals Required

| Decision | Required approver |
| --- | --- |
| Database credential rotation and external database access | Database/service owner |
| Render branch change, environment edits, deploy, health-check configuration | Release/service owner |
| Password policy minimum of 8 characters | Product and Security |
| Order cancel/expiry/refund/slot-release policy | Product, Operations, and Finance where payment is involved |
| Production mail provider / retention policy | Security and service owner |
| Object-storage provider and evidence retention | Security, Product, and service owner |
| VNPay sandbox/public enablement | Finance, Security, and Operations |
| Rate-limit provider thresholds/blocking behavior | Security and Operations |

## 13. Definition of Remediated

The system may move from **NOT READY** to **CONDITIONALLY READY FOR RELEASE REVIEW** only when:

- every Critical and High finding is fixed and backed by current evidence;
- no external credential remains usable after the reported exposure;
- all canonical quality gates pass after the final migration/code change;
- staging runs the exact reviewed SHA and `/api/ready` confirms database readiness;
- payment is either fully sandbox-qualified or remains safely disabled;
- customer registration, password recovery, catalog images, checkout reservation release, and role authorization have both positive and negative tests;
- residual Medium risks are documented with named owner, mitigation, and expiry date.

Until those conditions are met, do not label the project production-ready or use it for real customer payments/orders.
