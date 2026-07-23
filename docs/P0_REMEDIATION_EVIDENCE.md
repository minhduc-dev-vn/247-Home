# 247 Home P0 Remediation Evidence

## 1. Executive Status

Execution date: **2026-07-23**  
Branch: `feature/auto-update`  
Base revision: `f75cf64e369606cade4e81814e83e49df6336815`  
Non-destructive backup ref: `backup/p0-remediation-20260723`

**Repository remediation: PASS. Production release: BLOCKED pending external
verification and approval.**

Dependency, application, infrastructure-static, container, migration and local
payment-security gates pass. This environment had no AWS CLI/credentials,
provisioned staging outputs, ECR access, or VNPay merchant sandbox credentials.
Consequently this report does not claim an ECR registry digest, deployed HTTPS
behavior, restore/rollback result, real VNPay transaction, alert delivery, or
screenshot.

## 2. P0 Result Matrix

| ID | Finding | Repository result | External result | Final status |
|---|---|---|---|---|
| P0-01 | Vulnerable production dependency/image | Next.js 16.2.11, sharp 0.35.3, clean audit, both images clean and smoke-tested | ECR scan will repeat in release workflow | **PASS** |
| P0-02 | Process-local rate limiting | WAF is authoritative; CloudFront overwrites the trusted client address; production fails closed without WAF; unit/static tests pass | Shared quota across two deployed tasks and public 429 probe not executable here | **NEEDS REVIEW** |
| P0-03 | No immutable current-revision artifact | Runtime/migration targets build from one lockfile, scan, produce SBOM/provenance, and deploy by digest in CI | ECR push and registry digest unavailable | **NEEDS REVIEW** |
| P0-04 | Staging controls not proven | Terraform validates; HTTPS/WAF/private RDS/S3/Secrets Manager contracts exist | Real staging HTTPS, secret injection, origin denial, lifecycle and alarm checks unavailable | **NEEDS REVIEW** |
| P0-05 | Backup/restore/rollback evidence missing | Snapshot, private migration, invariant and rollback-by-digest scripts are prepared | RDS isolated restore and ECS rollback drill unavailable | **NEEDS REVIEW** |
| P0-06 | VNPay external readiness unverified | Signed QueryDR client, configuration verifier, bounded read-only reconciliation and tests pass | Real sandbox scenarios and Finance/Security approval unavailable | **NEEDS REVIEW** |
| P0-07 | Canonical release documents stale | README/scope/DoD/rate-limit status annotated; ADR and runbooks added | Product, Security, Finance and Platform approvals remain human actions | **NEEDS REVIEW** |

No unresolved Critical code or local artifact finding was observed. The
remaining P0 items are deployment/provider evidence, not silently downgraded
findings.

## 3. Implemented Remediation

### Dependency and Artifact Security

- `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` pin compatible,
  reviewed versions and use pnpm 11's build-script allowlist.
- `Dockerfile` builds separate runtime and migration targets. The runtime is
  standalone and non-root. The migration image generates Prisma Client, then
  removes npm/pnpm/Corepack/Yarn and invokes Prisma/tsx directly through Node.
- `.github/workflows/ci.yml` explicitly generates Prisma Client.
- `.github/workflows/staging-release.yml` builds paired images from one Git SHA,
  scans both, creates CycloneDX SBOMs, publishes immutable ECR digests, attaches
  provenance, snapshots RDS, runs private migrations/invariants and deploys the
  runtime by exact digest.

### Distributed Rate Limiting

- `infrastructure/modules/waf/main.tf` defines baseline, authentication and API
  mutation rate rules with structured 429 responses.
- `infrastructure/modules/cloudfront/main.tf` overwrites
  `x-247-client-address` from CloudFront viewer IP.
- `src/shared/http/client-address.ts` rejects untrusted forwarding data.
- `src/modules/identity/infrastructure/rate-limiter.ts` delegates production
  authority to WAF and refuses unsafe production fallback.
- `src/shared/validation/env.ts` enforces the runtime contract.
- `scripts/verify-staging-rate-limit.ts` is the deployed multi-instance probe.

### Staging, Secrets, Storage and Recovery

- Terraform passes the VNPay non-secret endpoint contract and Secrets Manager
  ARNs into ECS; secret values are never defined in Terraform.
- IAM evidence prefixes cover both installation and warranty evidence.
- The migration task has private networking, read-only root FS, no public IP,
  only the database secret, and a limited role.
- `scripts/create-rds-pre-migration-snapshot.ps1`,
  `scripts/run-ecs-migration-task.ps1`,
  `scripts/verify-database-invariants.ts`, and
  `scripts/rollback-ecs-runtime.ps1` enforce forward migration and
  schema-compatible digest rollback.

### VNPay Operations

- `src/modules/payment/infrastructure/vnpay-query-client.ts` creates and checks
  HMAC-SHA512 QueryDR messages, limits response size/time, requires HTTPS and
  verifies merchant/reference identity.
- `scripts/verify-vnpay-configuration.ts` rejects endpoint/environment mismatch.
- `scripts/payment-reconciliation-report.ts` reads at most 100 stale sessions,
  logs only hashed references, never mutates business state, and fails on
  discrepancies/provider errors.
- Payment create/webhook client-address handling now uses the trusted ingress
  helper.

No order, inventory, warranty, technician, or payment state-transition business
rule was changed by this remediation.

## 4. Regression Tests

New or updated tests:

- `tests/unit/client-address.test.ts`
- `tests/unit/env.test.ts`
- `tests/unit/identity-rate-limiter.test.ts`
- `tests/unit/infrastructure-security.test.ts`
- `tests/unit/vnpay-query-client.test.ts`

The existing full suite additionally verifies PostgreSQL transactions,
concurrency, migration upgrade, customer/admin/technician authorization,
evidence, Warranty, payment idempotency and Operations workflows.

## 5. Commands and Results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS, pnpm 11.16.0 |
| `pnpm db:generate` | PASS |
| `pnpm db:migrate` | PASS, 15 migrations, none pending |
| `pnpm audit:prod` | PASS, 180 production packages, no moderate-or-higher advisory |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 30 files / 107 tests |
| `pnpm test:integration` | PASS, 10 files / 68 tests |
| `pnpm test:migration` | PASS |
| `pnpm test:e2e` | PASS, 47/47 |
| `pnpm build` | PASS, Next.js 16.2.11 |
| Terraform `fmt -check` | PASS |
| Terraform staging `init -backend=false` + `validate` | PASS, AWS provider 6.54.0 |
| Terraform production `init -backend=false` + `validate` | PASS, AWS provider 6.54.0 |
| PowerShell parser checks | PASS |
| Bash `-n` checks | PASS |
| `pnpm verify:vnpay-config` with non-secret local staging configuration | PASS; not a sandbox transaction |
| Runtime/migration Docker builds | PASS |
| Trivy High/Critical scans | PASS, 0/0 for both images |
| Migration image against local PostgreSQL | PASS |
| Database invariant checker | PASS, all violation counts zero |
| Runtime health and image optimization smoke | PASS, HTTP 200 |

Raw local logs and scan/SBOM files are under
`%TEMP%\247-home-p0-evidence`. Their portable summary is
`docs/evidence/p0/LOCAL_VALIDATION_SUMMARY.txt`. CI uploads the corresponding
registry evidence artifact for a real staging run.

## 6. Artifact Evidence

These are local OCI image IDs, not ECR registry digests:

- Runtime:
  `sha256:67b98b610cc6f029211f8cb87b74501cb2f520e5d4d53d75dbcda7c9fc3ecc3d`
- Migration:
  `sha256:a05cd1c28ecbe60e50a66b7cfa66c8be007c3656ca794a77caeaa9ee5a2ddaa8`

Evidence SHA-256:

| Evidence | SHA-256 |
|---|---|
| Runtime Trivy JSON | `49ED703DCEB993E14CEEDFB8297BB97CB38454838F66E75109973D7BC6D7F20B` |
| Migration Trivy JSON | `9315E9EDD33A4C5168A7B4FE9BB51A1A2B5FA5C7C1C39E694FD22EED8D8919A2` |
| Runtime CycloneDX SBOM | `10213F5BAA154832E9E4F083D054EB137B1FB5DA08A6B95FF23CB5D67BC4DF7C` |
| Migration CycloneDX SBOM | `3A70B8B797D1ED469969D1606D7934D1D0403C2F4B2F677F353689E012804B81` |

Runtime smoke confirmed HTTP 200 for `/api/health`, HTTP 200 `image/png` from
the Next image optimizer, and `uid=1001(nextjs)`.

## 7. Evidence Not Available

### AWS Staging

Status: **NEEDS REVIEW**

AWS CLI/credentials and provisioned Terraform outputs were absent. The following
must be executed by the approved staging environment:

1. Publish runtime/migration images and record ECR repo digests.
2. Prove CloudFront HTTPS, HSTS/security headers, direct-origin denial and WAF
   shared quotas across at least two tasks.
3. Prove Secrets Manager injection without exposing values.
4. Prove private RDS connectivity and private S3 evidence authorization/
   lifecycle.
5. Execute snapshot, isolated restore and schema-compatible runtime rollback.
6. Attach CloudWatch links, redacted logs, RTO/RPO and approvers.

No screenshot is referenced because no deployed staging system was available.

### VNPay Sandbox

Status: **NEEDS REVIEW**

Merchant credentials and registered callbacks were absent. Required real cases
remain success, failure, cancellation, delayed/duplicate IPN, replay, tampered
signature and amount mismatch, followed by reconciliation and alert delivery.
`docs/VNPAY_SANDBOX_VALIDATION.md` intentionally contains no fabricated ID.

## 8. Documentation Evidence

- `docs/DEPENDENCY_SECURITY_RECORD.md`
- `docs/decisions/ADR-002-production-rate-limiting.md`
- `docs/RATE_LIMITING_RUNBOOK.md`
- `docs/PAYMENT_RECONCILIATION_RUNBOOK.md`
- `docs/VNPAY_SANDBOX_VALIDATION.md`
- `docs/STAGING_RECOVERY_DRILL_RECORD.md`
- `docs/P0_REMEDIATION_PLAN.md`
- `docs/evidence/p0/LOCAL_VALIDATION_SUMMARY.txt`

## 9. Release Decision

The source repository now contains a production-safe remediation path and all
locally executable P0 gates pass. **247 Home is not yet production ready**:
P0-02 through P0-07 require the real AWS/VNPay execution evidence and named
human approvals described above. Online VNPay and public production traffic
must remain disabled until those records are completed.
