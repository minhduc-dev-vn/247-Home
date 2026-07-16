# AWS Pre-Deployment Review

Status: **REVIEW TEMPLATE; NOT AUTHORIZED FOR APPLY**  
Last reviewed: 2026-07-15

This review is the mandatory gate before the first AWS Terraform plan and again
before each environment apply. Completing the repository code alone does not
satisfy it.

## Gate 1: identity and account

- [ ] Target account ID and environment alias match the change record.
- [ ] Root MFA, Identity Center, break-glass and security contacts are verified.
- [ ] GitHub OIDC trust uses `aud=sts.amazonaws.com` and exact protected
  environment `sub` claims for the canonical repository.
- [ ] No IAM user access key or long-lived CI credential exists for deployment.
- [ ] Plan, apply, migration and runtime roles have reviewed least-privilege
  policies and are tested with negative access cases.

## Gate 2: backend and Terraform

- [ ] Backend CloudFormation stack exists in the target account and region.
- [ ] State bucket is private, versioned, SSE-KMS encrypted and access logged.
- [ ] Lock table has PITR and encryption; `use_lockfile`/locking behavior is
  confirmed with the pinned Terraform version.
- [ ] Backend principal access and recovery were tested by an independent
  operator without exposing state.
- [ ] Real backend configuration and environment inputs are stored outside Git.
- [ ] `fmt`, `validate`, TFLint and CloudFormation lint pass on the exact commit.
- [ ] The reviewed plan is encrypted, access controlled and not published as a
  public CI artifact.

## Gate 3: security and network

- [ ] RDS and ECS have no public IP; PostgreSQL is not internet reachable.
- [ ] ALB accepts only CloudFront origin-facing ranges and the verified secret
  header; direct-ALB tests fail closed.
- [ ] S3 Block Public Access, TLS-only, SSE-KMS and scoped task-role permissions
  are confirmed with AWS policy simulation and runtime negative tests.
- [ ] CloudFront, WAF, ALB and application logs redact secrets and sensitive
  request headers.
- [ ] WAF begins in count mode and the named Security owner approves thresholds
  before block mode.
- [ ] GuardDuty/Security Hub/CloudTrail organization controls and alert routing
  are verified outside this application stack.

## Gate 4: data, secrets and migration

- [ ] Backup retention, deletion protection, final snapshot and restore drill
  meet the environment policy.
- [ ] Runtime and migration database roles are separate and least privileged.
- [ ] Secret definitions have current versions, ownership and rotation runbooks;
  Terraform contains no secret versions.
- [ ] Dedicated migration artifact is digest pinned and matches the application
  Prisma schema/migrations for the release.
- [ ] Migration rehearsal, backup, forward-fix and lock/downtime review passed.
- [ ] ECS service remains disabled until secret, database and image gates pass.

## Gate 5: DNS, release and operations

- [ ] Domain ownership and DNS change/rollback authority are verified.
- [ ] CloudFront ACM certificate is in `us-east-1`; ALB certificate is in the
  application region and covers the project-owned origin hostname.
- [ ] ECR repository is immutable, scan-on-push and KMS encrypted; only an
  approved `repository@sha256:...` digest is deployed.
- [ ] Staging gates passed on that same digest before production promotion.
- [ ] Health, auth, database, evidence upload/preview, log redaction, alarms and
  rollback smoke tests have named evidence.
- [ ] Incident owner, on-call contact, rollback operator and maintenance window
  are present in the change record.

## Cost review

Review the monthly and incident-driven cost of NAT gateways, ALB, CloudFront,
WAF, Fargate, RDS Multi-AZ/backup, KMS requests, S3 versions, logs, ECR scans and
data transfer. Budget thresholds and recipients must be real inputs. Cost
approval cannot be inferred from the architecture estimate.

## Decision record

| Decision | Required evidence |
| --- | --- |
| Approve Terraform plan | All missing-input items needed for target account are closed; Security and Cost reviewers sign |
| Approve staging apply | Reviewed plan, rollback owner, maintenance window and two-person approval |
| Approve production apply | Staging evidence on same digest, production backup/restore evidence and change authority approval |
| Reject/defer | Finding ID, owner, due date and next review; no apply |

Current decision: **DEFERRED**. Open items are tracked in
`docs/AWS_DEPLOYMENT_MISSING_INPUTS.md`.

