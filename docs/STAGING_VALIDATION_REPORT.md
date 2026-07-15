# 247 Home Staging Validation Report

Validation date: 2026-07-15, Asia/Bangkok

Operator: Codex automated release-validation operator

## 1. Deployment information

| Field | Value |
|---|---|
| Commit deployed | `3fb998f6d437b6c71d430a53c5f1667ea8e7a0ec` |
| Reviewed code commit | `3d2ab354bd81b8e534342787a0bc4b77c681ce8e` |
| Branch | `main` |
| Environment | Isolated local staging rehearsal; PostgreSQL 16; one production-mode app process |
| Public endpoint | None; HTTP loopback was used and stopped after validation |

The deployed commit is the reviewed code plus its documentation-only staging
readiness attestation. The tree was clean before deployment and migration
checksums matched the reviewed release.

## 2. Deployment result

**STAGING BLOCKED**

The deployment package boots and its database, auth, health, customer,
payment, authorization and rollback checks largely pass. The required
installation workflow does not pass in production mode because there is no
staging evidence-storage provider. In addition, the rehearsal has no HTTPS
ingress or approved secret manager. These are High release blockers under the
staging decision rule.

Critical findings: 0

High findings: 2

Medium findings: 3

Low findings: 1

## 3. Environment verification

| Check | Result | Evidence |
|---|---|---|
| Node/pnpm versions | PASS | Node 24.14.0; pnpm 10.32.1 |
| PostgreSQL version | PASS | PostgreSQL 16.14 in isolated Docker database |
| Dedicated DB roles | PASS | Migration/runtime roles are non-superuser and cannot create DBs |
| UTC policy | PASS | Final Node process and PostgreSQL reported UTC |
| Single instance | PASS | One listener; process-local limiter assumption retained |
| Secrets absent from Git/build/log | PASS FOR REHEARSAL | Tracked/build scans and structured-log review found no injected secret |
| Approved secret manager | FAIL | Secrets were ephemeral process values only |
| HTTPS/final ingress | FAIL | HTTP loopback only; **BLOCKED FOR PUBLIC TRAFFIC** |
| Staging evidence storage | FAIL | No provider configured; production guard rejected upload |

The complete variable-level result is in `STAGING_ENVIRONMENT_MATRIX.md`.

## 4. Database verification

- A new database, `home247_staging_deployment_20260715_rc1`, was used. It was
  not the local development or production database.
- A readable custom-format backup was taken before migration.
- `pnpm db:migrate` applied all 11 migrations; none remained pending.
- Required Operations exclusion/timestamp constraints and critical uniqueness
  indexes were present and validated.
- `pnpm db:seed` ran twice. Counts remained 12 active products, 4 service
  packages and 2 demo orders.
- Final invariants were zero unresolved allocations, zero inventory mismatches,
  zero slot mismatches and zero unvalidated constraints.
- A post-deploy dump restored into a different database with exact critical
  counts and invariants. No reset, drop or truncate was performed.

## 5. Health checks

| Check | Result |
|---|---|
| Application boot | PASS; ready in 250 ms |
| Database connection | PASS through `/api/ready` and runtime queries |
| `/api/health` | PASS; HTTP 200 |
| `/api/ready` | PASS; HTTP 200 |
| CSP | PASS |
| `X-Content-Type-Options` | PASS; `nosniff` |
| `Referrer-Policy` | PASS; `strict-origin-when-cross-origin` |
| Frame protection | PASS; CSP `frame-ancestors 'none'` and `X-Frame-Options: DENY` |
| Auth cookie | PASS; `HttpOnly`, `Secure`, `SameSite=Lax` |
| HTTPS delivery | FAIL; cookie attributes were inspected on loopback only |

The final process was stopped after evidence collection because no public-safe
ingress existed.

## 6. Business smoke tests

| Flow | Result | Evidence |
|---|---|---|
| Register and login | PASS | New user registered; login and authenticated session succeeded |
| Browse products/service area | PASS | Catalog E2E passed |
| Cart and installation checkout | PASS | Order creation E2E passed; server price/inventory behavior retained |
| Out-of-stock checkout | PASS | E2E returned and rendered the expected conflict |
| Manual payment | PASS | Manager confirmation and stale-version conflict E2E passed; audit asserted |
| Manager assignment | PASS | Suitable technician assignment and audit E2E passed |
| Manager reschedule/conflict | PASS | Successful update preserved when conflicting retry failed |
| Technician own-job list | PASS | Ownership, filter and pagination E2E passed |
| Technician complete workflow | **FAIL** | Evidence upload returned HTTP 400 before completion |
| Admin/Operations access | PASS WITH COVERAGE LIMIT | Manager Operations actions and customer/Staff denials passed |

The external-server Playwright run used `playwright.staging.config.ts`, one
worker, zero retries and the deployed production process. Result: **13/14
passed** in 22.5 seconds. The failure left zero fixture namespaces, evidence
rows, upload files, unresolved allocations or slot mismatches.

## 7. Security smoke tests

| Check | Result |
|---|---|
| Customer denied admin | PASS |
| Cross-technician read/action IDOR | PASS |
| Staff assignment privilege denial | PASS |
| Invalid session | PASS; HTTP 401 |
| Revoked/stale session | PASS; `authVersion` change caused HTTP 401 |
| Invalid mutation payload | PASS; HTTP 400 |
| Invalid content type | PASS; HTTP 415 |
| Oversized body | PASS; HTTP 413 |
| Invalid origin | PASS; HTTP 403 |
| Mutation rate limit | PASS; repeated requests reached HTTP 429 |
| Unauthorized evidence preview | PASS; HTTP 401 |
| Cookie flags and response headers | PASS on loopback response inspection |

No destructive penetration test was performed. Logs were scanned for the
injected secret and sensitive request fields; none was retained in the reviewed
structured events or build artifact.

## 8. Performance baseline

Startup was 250 ms. Sequential 20-request probes measured health p95 at 16.89
ms and product-list p95 at 17.59 ms. A successful checkout API request was
51.72 ms and Manager assignment was 30.97 ms. See
`STAGING_PERFORMANCE_BASELINE.md` for all samples and limitations.

PostgreSQL slow-query logging was disabled and no managed metrics/alert sink
was present. The local same-host numbers are comparison data only.

## 9. Rollback readiness

- Application stop and restart were exercised successfully.
- Pre-migration and post-deploy custom backups had readable manifests.
- The post-deploy backup restored into a separate probe database with matching
  data and invariants.
- No destructive rollback was attempted.
- Database recovery is verified, but no previous immutable application
  artifact is available because the repository has no tag, remote, image or
  artifact registry record.

See `STAGING_ROLLBACK_RECORD.md` for the recovery procedure and exact counts.

## 10. Remaining risks and findings

### STG-H-01 - Staging evidence storage unavailable - High

**Error:** the Technician workflow cannot upload required completion evidence
in a production-mode deployment.

**Log evidence:** Playwright's Technician workflow received HTTP 400 from
`POST /api/v1/technician/assignments/{id}/evidence`; the image preview never
appeared. The server guard in
`src/modules/operations/infrastructure/local-evidence-storage.ts` reports
`Local evidence storage is disabled in production.`

**Reproduce:** start the built application with `NODE_ENV=production`, log in
as the assigned Technician, progress to `IN_PROGRESS`, upload a valid evidence
image, and observe HTTP 400. The same failure occurs in
`tests/e2e/operations-technician-workflow.spec.ts` against the external server.

**Remediation:** integrate an approved staging object-storage adapter with
private objects, MIME/size validation, authorized preview and tested cleanup.
Do not remove or weaken the production-mode guard. Rerun the full external
staging E2E suite after configuration.

### STG-H-02 - No public-safe staging platform controls - High

**Error:** the deployed rehearsal used HTTP loopback and ephemeral process
secrets, not approved HTTPS ingress and secret-manager injection.

**Evidence:** `APP_URL`/Auth URL were loopback HTTP; no TLS listener, certificate
or managed secret source existed. `TRUST_PROXY_HEADERS=false` was correct for
this topology.

**Reproduce:** inspect the deployment endpoint and environment source; only
`http://127.0.0.1:3100` and process-level injection are available.

**Remediation:** provision the approved staging hostname and TLS termination,
strip untrusted forwarding headers, inject rotated secrets from the platform
secret manager, set final HTTPS origins, and repeat health/cookie/origin tests.

### STG-M-01 - No immutable application artifact - Medium

The source deployment has no tag, remote, container image, checksum or previous
compatible artifact. Publish one build-once artifact for the approved commit
and retain its predecessor before shared staging use.

### STG-M-02 - Incomplete staging observability - Medium

Structured stdout works, but no managed log sink, alert delivery, resource
metrics or PostgreSQL slow-query threshold was configured. Connect these to the
staging owner and exercise crash, readiness and 5xx alert paths.

### STG-M-03 - Dedicated database runbook file absent - Medium

The requested `docs/DATABASE_RUNBOOK.md` does not exist. Backup, migration,
restore and forward-fix procedures are currently contained in
`docs/STAGING_OPERATIONS_RUNBOOK.md` and migration notes. Consolidate these into
the expected database runbook and assign an owner before production review.

### STG-L-01 - Prisma package configuration warning - Low

Prisma 6 accepts `package.json#prisma`, but it should move to
`prisma.config.ts` before Prisma 7. This did not affect migration or seed.

## 11. Production blockers

1. Resolve STG-H-01 and pass the complete Technician evidence/completion E2E on
   a freshly started staging deployment.
2. Resolve STG-H-02; public traffic remains prohibited without HTTPS ingress,
   final origin/proxy validation and managed secrets.
3. Produce and retain an immutable application artifact plus a compatible
   rollback artifact.
4. Configure shared production-grade rate limiting before adding a second
   instance.
5. Configure log/metric/alert ownership and slow-query visibility.
6. Repeat all staging smoke, security and rollback checks on the actual staging
   platform; local rehearsal evidence is not production approval.

## Commands and results

| Command/check | Result |
|---|---|
| `git status`, `git branch`, `git log --oneline -5`, `git tag` | PASS before deployment; commit/branch recorded, no tag/remote |
| `pnpm install --frozen-lockfile` | PASS |
| Pre-migration `pg_dump --format=custom` and manifest read | PASS; 963-byte empty baseline |
| `pnpm db:migrate` | PASS; 11 migrations, none pending |
| `pnpm db:seed` twice | PASS; idempotent counts/invariants |
| Constraint/index/invariant SQL | PASS |
| `pnpm build` | PASS |
| Production `pnpm start` | PASS; one process, 250 ms startup |
| Health/readiness/header/cookie probes | PASS on loopback; HTTPS not available |
| External `pnpm exec playwright test --config=playwright.staging.config.ts` | **FAIL; 13/14**, Technician evidence upload HTTP 400 |
| Security negative request probes | PASS; expected 400/401/403/413/415/429 responses |
| Performance probes and trace parsing | COMPLETE; baseline recorded |
| Post-deploy `pg_dump`, isolated `pg_restore`, invariant comparison | PASS |
| Application stop and listener check | PASS; zero listener after blocked validation |
| `pnpm format:check` after report creation | PASS |
| `pnpm lint` after report creation | PASS; zero warnings |
| `pnpm typecheck` after report creation | PASS |
| `pnpm test` after report creation | PASS; 16 files, 53 tests |
| `pnpm build` after report creation | PASS; optimized Next.js production build |

## Final decision

**STAGING BLOCKED**

Do not label this release `STAGING VALIDATED`, expose it to public traffic or
promote it to production. Remediate the two High findings and rerun deployment,
migration confirmation, full E2E, HTTPS/security and rollback validation on the
actual staging platform.
