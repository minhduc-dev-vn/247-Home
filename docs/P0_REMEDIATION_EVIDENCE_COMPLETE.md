# 247 Home P0 Remediation Evidence Complete

## 1. Executive Summary

Execution date: **2026-07-23**  
Repository: `minhduc-dev-vn/247-Home`  
Branch: `feature/auto-update`  
Immutable release tag: `v0.1.0-staging-p0.1`  
Release commit: `c34063603191a17492dd0684b22a563c3d9759cb`

**Final execution status: FAIL - PRODUCTION RELEASE BLOCKED.**

The remaining P0 workflow was started against an immutable, published revision.
All repository quality gates passed on that revision. The deployment then
stopped safely before AWS authentication because the GitHub `staging`
environment contains no AWS variables or secrets. No AWS staging account,
provisioned infrastructure, ECR registry, RDS instance, public staging URL, or
VNPay sandbox merchant binding was available.

This report does not convert missing external evidence into a pass. Repository
remediation is proven; P0-02 through P0-07 remain open for real staging
execution and required human approval.

## 2. Result Matrix

| ID | Control | Execution result | Evidence | Status |
|---|---|---|---|---|
| P0-01 | Dependency patch | Patched graph, production audit and current-revision quality suite passed | Quality job `89240266367`; `DEPENDENCY_SECURITY_RECORD.md` | **PASS** |
| P0-02 | Distributed WAF/CloudFront limiter | Repository controls/tests exist; no deployed WAF or multi-instance endpoint was available for load validation | `RATE_LIMITING_RUNBOOK.md`; staging preflight record | **NEEDS REVIEW** |
| P0-03 | Immutable artifact/deployment | Immutable tag accepted; ECR build/push was blocked before AWS login because required bindings were empty | Artifact job `89241608623` | **FAIL** |
| P0-04 | HTTPS, secrets, RDS and S3 staging | Terraform contracts exist; no real plan/apply or runtime staging resource was available | `STAGING_SECRET_MANAGEMENT.md`; staging preflight record | **NEEDS REVIEW** |
| P0-05 | Backup, restore and rollback | Recovery scripts exist; no RDS identifier, snapshot target, ECR digest or approved drill window was available | `STAGING_RECOVERY_DRILL_RECORD.md` | **NEEDS REVIEW** |
| P0-06 | VNPay sandbox/reconciliation | Signed local tests passed; no merchant credentials, registered callback or provider transaction was available | `VNPAY_SANDBOX_VALIDATION.md` | **NEEDS REVIEW** |
| P0-07 | Canonical documentation | Repository documents and run references are reconciled; Product/Security/Finance/Platform approvals are absent | This report and linked runbooks | **NEEDS REVIEW** |

## 3. Execution Evidence

### Published Revision

- Commit `9d3e387`: `Harden P0 release infrastructure and payment operations`
- Commit `c340636`: `Stabilize customer layout E2E fixture`
- Annotated tag `v0.1.0-staging-p0.1` points to
  `c34063603191a17492dd0684b22a563c3d9759cb`.
- Repository CI run
  [`30016769995`](https://github.com/minhduc-dev-vn/247-Home/actions/runs/30016769995):
  **PASS**.

### Immutable Staging Attempt

Staging release run:
[`30017223927`](https://github.com/minhduc-dev-vn/247-Home/actions/runs/30017223927)

The
[`quality` job](https://github.com/minhduc-dev-vn/247-Home/actions/runs/30017223927/job/89240266367)
passed:

| Gate | Result |
|---|---|
| Immutable staging tag check | PASS |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm audit:prod` | PASS, 180 packages, no moderate-or-higher advisory |
| `pnpm db:migrate` | PASS, all migrations applied |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 30 files / 107 tests |
| `pnpm test:integration` | PASS, 10 files / 68 tests |
| `pnpm test:migration` | PASS |
| `pnpm test:e2e` | PASS, 47/47 |
| `pnpm build` | PASS |

The
[`artifacts` job](https://github.com/minhduc-dev-vn/247-Home/actions/runs/30017223927/job/89241608623)
failed at `Require reviewed AWS bindings`. Its redacted environment showed:

```text
AWS_REGION:
AWS_ROLE_ARN:
ECR_REPOSITORY_URL:
Process completed with exit code 1.
```

AWS credential configuration, ECR login, image publication, registry scans,
SBOM/provenance attestation and digest recording were skipped. The
`deploy-staging` job was consequently skipped. This is the intended fail-closed
behavior and confirms that no unreviewed cloud mutation occurred.

### Binding Audit

The workflow created the GitHub environment named `staging`, but:

- `gh variable list --env staging` returned no variables;
- `gh secret list --env staging` returned no secrets;
- no local `AWS_*` or `VNPAY_*` environment variables were present;
- AWS CLI and an authenticated AWS profile were unavailable;
- Terraform environment examples still contain account-specific placeholders.

No secret value is included in this report or its evidence files.

## 4. P0-02 Distributed Rate Limiter

### Step Executed

The immutable workflow and AWS binding preflight were executed. Repository
tests verified trusted ingress parsing, production fail-closed behavior and
Terraform WAF/CloudFront contracts.

### Missing External Validation

No deployed CloudFront/WAF endpoint or two-task ECS service existed, so the
following could not be run:

- multi-instance controlled load;
- WAF count-to-block validation;
- spoofed forwarding-header test against public ingress;
- direct-origin denial;
- CloudWatch sampled request and 429 evidence.

### Status

**NEEDS REVIEW.** Security and Operations must provide reviewed WAF thresholds,
deploy the staging stack, run `scripts/verify-staging-rate-limit.ts`, and attach
CloudWatch evidence.

## 5. P0-03 Immutable Artifact and Deployment

### Step Executed

An annotated immutable tag was pushed and accepted by the workflow. The source
revision passed every quality gate.

### Result

**FAIL.** The ECR phase did not execute because `AWS_REGION`,
`AWS_ROLE_ARN`, and `ECR_REPOSITORY_URL` were absent. Consequently there is no
registry digest, container/task ID, ECR scan, remote SBOM/provenance, release
manifest, or staging smoke result.

### Required Rerun

Configure the reviewed GitHub environment bindings, provision ECR/ECS/RDS/S3,
then rerun the same immutable tag or create a new reviewed immutable tag if any
source or infrastructure input changes.

## 6. P0-04 Staging Infrastructure and Secrets

### Step Executed

The release attempted entry into the protected `staging` environment and
stopped before credentials. No Terraform apply was performed.

### Result

**NEEDS REVIEW.** No real evidence exists yet for:

- CloudFront HTTPS and certificate chain;
- ALB direct-origin denial;
- Secrets Manager injection and rotation;
- private RDS connectivity;
- S3 encryption, access controls and lifecycle;
- ECS/CloudWatch logs and alarms;
- Terraform plan/apply diff.

The next execution must use GitHub OIDC and reviewed environment variables. It
must not introduce long-lived AWS keys or place secret values in Terraform
state.

## 7. P0-05 Backup, Restore and Rollback

### Step Executed

Recovery scripts and the release fail-closed ordering were validated by the
repository suite. The staging workflow did not reach snapshot creation.

### Result

**NEEDS REVIEW.** There is no RDS snapshot ID, isolated restored database,
measured RPO/RTO, invariant result on the restore, previous compatible runtime
digest, ECS rollback task, or post-rollback smoke result.

The source database must not be reset, truncated, reverse-migrated, or reused as
the restore target. Follow `STAGING_RECOVERY_DRILL_RECORD.md` in an approved
maintenance window.

## 8. P0-06 VNPay Sandbox

### Step Executed

Current-revision unit, integration and E2E tests passed for signed callbacks,
idempotency, payment transitions and QueryDR parsing. Those tests prove the
repository contract only.

### Result

**NEEDS REVIEW.** There was no VNPay merchant sandbox configuration, registered
public HTTPS IPN/return URL, provider transaction, signed provider webhook,
reconciliation response, alert delivery, or Finance/Security approval.

Production VNPay must remain disabled until the real scenario matrix in
`VNPAY_SANDBOX_VALIDATION.md` is completed with redacted provider evidence.

## 9. P0-07 Canonical Documentation

The current release references these canonical records:

- `README.md`
- `docs/P0_REMEDIATION_PLAN.md`
- `docs/P0_REMEDIATION_EVIDENCE.md`
- `docs/DEPENDENCY_SECURITY_RECORD.md`
- `docs/RATE_LIMITING_RUNBOOK.md`
- `docs/STAGING_SECRET_MANAGEMENT.md`
- `docs/STAGING_RECOVERY_DRILL_RECORD.md`
- `docs/VNPAY_SANDBOX_VALIDATION.md`
- `docs/PAYMENT_RECONCILIATION_RUNBOOK.md`
- `docs/PRODUCTION_RELEASE_CHECKLIST.md`
- `docs/decisions/ADR-002-production-rate-limiting.md`
- `docs/evidence/p0/STAGING_EXECUTION_ATTEMPT_20260723.txt`

Repository documentation is current for this execution attempt. Formal Product,
Security, Finance, Platform/Operations and Release approvals are still required.

## 10. Evidence Inventory

| Evidence | Reference |
|---|---|
| Repository CI PASS | GitHub Actions run `30016769995` |
| Immutable staging run | GitHub Actions run `30017223927` |
| Quality gates | Job `89240266367` |
| AWS preflight failure | Job `89241608623` |
| Redacted portable record | `docs/evidence/p0/STAGING_EXECUTION_ATTEMPT_20260723.txt` |
| Earlier local container/scan evidence | `docs/evidence/p0/LOCAL_VALIDATION_SUMMARY.txt` |
| Recovery status | `docs/STAGING_RECOVERY_DRILL_RECORD.md` |
| VNPay status | `docs/VNPAY_SANDBOX_VALIDATION.md` |

No AWS/VNPay screenshot is referenced because no deployed staging resource or
provider transaction existed. The linked GitHub Actions logs are the
authoritative remote evidence for the attempted execution.

## 11. Warnings and Required Actions

1. Provision or identify the approved AWS staging account and Terraform remote
   state backend.
2. Apply reviewed Terraform and populate the `staging` GitHub environment with
   non-secret variables and OIDC role ARN; inject application secret values
   directly into AWS Secrets Manager.
3. Rerun the immutable release and retain ECR digests, scans, SBOM, provenance,
   release manifest, ECS task IDs and HTTPS smoke logs.
4. Run the WAF multi-instance probe and attach sampled requests/metrics.
5. Execute isolated RDS restore and schema-compatible ECS rollback drills.
6. Provision the VNPay sandbox merchant, register staging callbacks and execute
   the complete real-provider test matrix.
7. Collect named Security, Finance, Operations and Release approvals.

## 12. Release Decision

The current revision is healthy and the deployment pipeline fails closed as
designed. It is ready for an authorized staging operator to continue, but it is
**not reviewable as production-ready evidence yet**.

**PRODUCTION RELEASE BLOCKED: P0-02 through P0-07 require real AWS/VNPay
staging execution and human approvals.**
