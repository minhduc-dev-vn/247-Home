# 247 Home Real Staging Validation Report

Validation attempt: `2026-07-15T09:02:22Z`

Operator: `ducvu` with Codex release-validation assistance

Scope: real staging release validation; no production deployment

## 1. Deployment identity

| Field | Result |
|---|---|
| Branch | `main` |
| Current HEAD | `904655f11e4511cfdc1666f8d6f6e6375cc9e8b6` |
| Package version | `0.1.0` |
| Release commit | **NOT DETERMINED**; working tree is dirty |
| Release version | **NOT ASSIGNED** |
| Deployment operator | `ducvu` / Codex validation assistance |
| Deployment timestamp | No deployment occurred |

The uncommitted remediation includes runtime, dependencies, tests and docs.
HEAD does not identify the package that passed remediation tests. Phase 0 fails.

## 2. Artifact information

**FAIL.** No Dockerfile, application image, registry location, image digest,
release tag, provenance, SBOM, signature, build timestamp or previous rollback
artifact exists. Docker Compose is local PostgreSQL tooling only.

Source-only checksums:

- lockfile SHA-256:
  `7bd48b0e6a905ad076e5dac40ddb43278b74271c43d84e0e0158913e2e83a3c1`;
- ordered 11-migration manifest SHA-256:
  `ac43ae08e369603b3e20600fecd25e523af4491074f861749a664e9c1ce689d5`.

See `STAGING_ARTIFACT_VALIDATION.md`.

## 3. Infrastructure verification

**FAIL.** No `STAGING_BASE_URL`, DNS name, TLS certificate, ingress binding,
staging database binding, secret-manager binding, storage binding or deployment
workflow was supplied. No localhost/HTTP/mock substitute was used.

## 4. Secret validation

**NOT RUN.** Required staging variables were absent from the validation process,
and no secret-manager references or non-secret version identifiers were
available. The local `.env` was not accepted as staging evidence. Rotation,
restart, login and evidence smoke after rotation could not run.

See `STAGING_SECRET_VALIDATION.md`.

## 5. Database validation

**NOT RUN.** No PostgreSQL 16 staging database or migration credential was
provided. Consequently no staging backup, `pnpm db:migrate`, constraint/index
inspection, inventory/allocation invariant, appointment invariant, exclusion
constraint check, seed-idempotency run or restore drill was performed.

The Prisma schema and all 11 migration files are unchanged from HEAD. The local
development database was deliberately not used. Required procedures are in
`DATABASE_RUNBOOK.md`.

## 6. Storage validation

**NOT RUN.** No approved AWS S3, staging MinIO, R2 or equivalent provider was
bound. Private bucket policy, encryption, access logging, least privilege,
upload, preview, authorization, delete lifecycle, failed-DB cleanup and orphan
count therefore remain unverified on real infrastructure. The mock/test server
was not started.

See `STAGING_STORAGE_VALIDATION.md`.

## 7. HTTPS validation

**NOT RUN.** A real HTTPS hostname does not exist in the supplied environment.
DNS, certificate, redirect, cookie flags through ingress, forwarding-header
spoof rejection, security headers and authenticated cache headers could not be
tested. HTTP loopback was not used.

See `STAGING_INGRESS_VALIDATION.md`.

## 8. Business smoke tests

**NOT RUN ON REAL STAGING.** Customer registration/login/catalog/cart/checkout,
Manager payment/assignment, Technician evidence/completion and Admin Operations
require the deployed HTTPS artifact, real staging database and real object
storage. Previous local E2E results are remediation evidence only and do not
satisfy this release-validation phase.

## 9. Security tests

**NOT RUN ON REAL STAGING.** Invalid/expired sessions, Customer admin denial,
cross-Technician IDOR, Staff privilege denial, invalid Origin/content type/body,
rate limiting and unauthorized evidence access were not retested through the
real ingress and platform services.

## 10. Performance baseline

**NOT COLLECTED.** There is no deployed staging endpoint. Local startup/latency
measurements were not reused. See `STAGING_PERFORMANCE_BASELINE.md`.

## 11. Rollback evidence

**FAIL.** Neither current nor previous immutable artifact exists, and there is
no staging database backup. Application rollback and post-rollback health/auth/
checkout/Operations checks could not run. No destructive reverse migration was
attempted. See `STAGING_ROLLBACK_VALIDATION.md`.

## 12. Remaining risks and blockers

### STG-REL-H-01 - Release identity is not immutable - High

**Evidence:** dirty working tree; HEAD excludes the remediation; no release tag
or remote.

**Required action:** human-review and commit remediation, run trusted CI, and
approve that exact SHA.

### STG-ART-H-01 - Immutable deployment artifact missing - High

**Evidence:** no Dockerfile, registry workflow/location, image digest, artifact
manifest or previous digest.

**Required action:** publish and sign a build-once OCI artifact, record
`image@sha256:<digest>`, and retain a compatible rollback digest.

### STG-INF-H-01 - Real HTTPS staging environment missing - High

**Evidence:** `STAGING_BASE_URL` absent; DNS/TLS/ingress cannot be inspected.

**Required action:** provision the final HTTPS hostname, trusted ingress and
network isolation, then run ingress validation.

### STG-SEC-H-01 - Secret manager not bound - High

**Evidence:** no staging runtime/secret references or rotation evidence.

**Required action:** inject environment-scoped database/Auth/storage secrets
from an approved manager and execute rotation validation without logging values.

### STG-DB-H-01 - Staging database unavailable - High

**Evidence:** no approved staging `DATABASE_URL`, backup or migration result.

**Required action:** provision PostgreSQL 16 with separate migration/runtime
roles, back up, migrate once, verify constraints/invariants and restore drill.

### STG-STO-H-01 - Real private object storage unavailable - High

**Evidence:** no approved bucket/provider binding; mock use is prohibited.

**Required action:** provision private encrypted logged S3-compatible storage,
least-privilege identity and run complete evidence lifecycle/cleanup validation.

### STG-RBK-H-01 - Rollback cannot be exercised - High

**Evidence:** no current/previous artifact and no staging database backup.

**Required action:** retain both digests, verify schema compatibility and execute
application rollback smoke tests without reversing migrations destructively.

## Commands and evidence

| Command/check | Result |
|---|---|
| `git status` | FAIL release gate; modified and untracked remediation files |
| `git branch --show-current` | `main` |
| `git log --oneline -10` | HEAD `904655f`; remediation not committed |
| `git tag --list` | No tags |
| `git remote -v` | No remote |
| Dockerfile check | Missing |
| Application image/digest check | Zero matching images; no registry digest |
| Staging deploy workflow scan | Zero matching workflows |
| Required environment-name presence check | All staging URL/artifact/DB/Auth/storage bindings absent |
| `git diff --name-only -- prisma/schema.prisma prisma/migrations` | PASS; no schema/migration change |
| Lockfile/migration checksum calculation | COMPLETE; values recorded above |
| `pnpm db:migrate` | NOT RUN; no real staging database |
| `pnpm test:e2e:staging` | NOT RUN; no real HTTPS endpoint/storage |
| Business/security/performance/rollback smoke | NOT RUN; infrastructure preconditions absent |

## Final decision

**STAGING BLOCKED**

No deployment was performed. Do not expose traffic or claim `STAGING VALIDATED`.
Resolve every High blocker, then repeat all phases against the actual HTTPS
staging platform using the deployed immutable digest and real managed services.
