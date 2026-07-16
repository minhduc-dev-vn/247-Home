# AWS Deployment Prerequisite Report

Status: **AWS DEPLOYMENT BLOCKED**  
Assessment date: 2026-07-15  
Deployment activity: **NONE**

## Executive result

The repository now contains a coherent AWS account, remote-state, OIDC, ECR,
secret, database, migration, storage-IAM, DNS/TLS and pre-deployment design.
Offline infrastructure and application validation can prove that these contracts
are internally consistent. It cannot prove that accounts, identities, domains,
certificates, state stores, images or secret versions exist.

No `terraform plan`, `terraform apply`, AWS resource creation, production
migration or secret operation was performed. The project must not be labelled
AWS deployment prerequisites ready until the real inputs and account evidence in
`AWS_DEPLOYMENT_MISSING_INPUTS.md` are closed.

## Readiness matrix

| Area | Repository deliverable | Readiness | Blocking evidence |
| --- | --- | --- | --- |
| Account landing zone | `AWS_ACCOUNT_SETUP.md` | Design ready | MI-01 through MI-03 |
| Remote state | `TERRAFORM_BACKEND_SETUP.md`, CloudFormation bootstrap template | Code ready, not provisioned | MI-04, MI-05 |
| GitHub federation | `GITHUB_OIDC_SETUP.md` | Trust contract ready | MI-06, MI-07 |
| Release artifact | `ECR_RELEASE_FLOW.md`, Terraform ECR module | Design/code ready | MI-10; current staging flow has not published an AWS ECR digest |
| Secret management | `AWS_SECRET_MANAGEMENT_PLAN.md` | Contract ready | MI-11, MI-14 |
| Database bootstrap | `DATABASE_BOOTSTRAP_PLAN.md` | Runbook ready | MI-12 |
| Migration execution | `MIGRATION_EXECUTION_DESIGN.md` | Design only | MI-13 |
| Evidence storage IAM | `STORAGE_IAM_MIGRATION_PLAN.md`, storage factory and ECS task role | Repository remediation complete | Target-account policy/runtime verification remains part of MI-10/MI-11 |
| Domain and TLS | `DOMAIN_CERTIFICATE_PLAN.md` | Design ready | MI-08, MI-09 |
| Monitoring and security operations | Terraform monitoring/WAF modules and pre-deployment review | Code/design ready | MI-16, MI-17 |
| Cost/change approval | `AWS_PRE_DEPLOYMENT_REVIEW.md` | Template ready | MI-03, MI-18 |

## Implemented controls

- Separate staging and production Terraform roots and remote backend examples.
- CloudFormation backend bootstrap avoids a local Terraform state bootstrap
  dependency and retains encrypted state, logs, KMS key and lock table.
- GitHub OIDC design uses exact repository/environment claims and short-lived
  roles; no IAM access key is introduced.
- ECS uses an application task role. Native AWS S3 no longer requires static
  access keys; custom endpoints fail closed without an explicit credential pair.
- CloudFront and ALB TLS use separate regional certificate contracts and a
  project-owned ALB origin hostname.
- RDS, S3, ECR, network, logging, WAF and secret-definition controls are encoded
  in reviewable Terraform with destructive-resource protections.

## Repository changes

| Scope | Files |
| --- | --- |
| Required prerequisite documents | `docs/AWS_ACCOUNT_SETUP.md`, `docs/TERRAFORM_BACKEND_SETUP.md`, `docs/GITHUB_OIDC_SETUP.md`, `docs/ECR_RELEASE_FLOW.md`, `docs/AWS_SECRET_MANAGEMENT_PLAN.md`, `docs/STORAGE_IAM_MIGRATION_PLAN.md`, `docs/DATABASE_BOOTSTRAP_PLAN.md`, `docs/MIGRATION_EXECUTION_DESIGN.md`, `docs/DOMAIN_CERTIFICATE_PLAN.md`, `docs/AWS_PRE_DEPLOYMENT_REVIEW.md` |
| Readiness and missing-input evidence | `docs/AWS_DEPLOYMENT_MISSING_INPUTS.md`, this report |
| Backend bootstrap | `infrastructure/backend/bootstrap/backend.template.yaml`, both parameter examples, both `.s3.tfbackend.example` files and backend README |
| OIDC trust hardening | `infrastructure/modules/iam/main.tf`, `infrastructure/modules/iam/variables.tf`; exact `StringEquals` subjects with wildcard rejection |
| AWS TLS/origin contract | platform module variables/composition/outputs and both environment roots/examples under `infrastructure/` |
| Storage IAM implementation | `src/modules/storage/storage-factory.ts`, `src/modules/storage/object-storage-adapter.ts`, `infrastructure/modules/ecs/locals.tf` |
| Storage regression tests | `tests/unit/storage-factory.test.ts`, `tests/unit/object-storage-adapter.test.ts` |
| Repository artifact safety | `.gitignore` excludes Terraform state, plans, provider cache and real `.tfvars` files |
| Synchronized current documentation | `infrastructure/README.md`, `docs/AWS_INFRASTRUCTURE_AS_CODE.md`, `docs/TERRAFORM_VALIDATION_REPORT.md`, `docs/STAGING_SECRET_MANAGEMENT.md`, `docs/STAGING_SECRET_SETUP.md`, `docs/STAGING_SECRET_VALIDATION.md` |

No Prisma schema, migration, business state machine or production dependency was
changed.

## Blocking findings

| ID | Severity | Finding | Required action |
| --- | --- | --- | --- |
| B-01 | Critical | Target AWS accounts and governance evidence are absent | Complete MI-01 to MI-03 and obtain Security/Finance approval |
| B-02 | Critical | Remote backend resources and protected execution principal do not exist in verified form | Bootstrap per `TERRAFORM_BACKEND_SETUP.md`, independently verify outputs and recovery |
| B-03 | High | Canonical GitHub identity and AWS OIDC role bindings are absent | Complete MI-06/MI-07 and prove positive/negative role assumption in CloudTrail |
| B-04 | High | Domain ownership, DNS and both certificate scopes are unverified | Complete MI-08/MI-09 and validate CloudFront-to-origin TLS |
| B-05 | High | No approved ECR release digest has been produced | Implement and run the reviewed ECR flow; retain scan and provenance evidence |
| B-06 | High | Database roles/secrets and dedicated migration runner are not provisioned or rehearsed | Complete MI-11 to MI-13 on staging with backup/forward-fix evidence |
| B-07 | High | Production password-reset mail and product/media storage readiness remain unresolved application launch gates | Close MI-14/MI-15 before production launch |
| B-08 | Medium | Alert recipients, WAF thresholds, budget and apply authority have no named approval | Complete MI-16 to MI-18 |

## Authorization to proceed

- **Terraform plan:** not authorized. First close B-01 through B-04 and establish
  the protected backend/OIDC path with real non-secret identifiers.
- **Terraform apply:** prohibited by this task and not approved.
- **Staging deployment:** blocked by B-01 through B-06.
- **Production deployment:** blocked by every finding above and by successful
  staging evidence on the same image digest.

## Verification record

The exact commands and results from the final repository state are recorded
after execution in the section below. A command may be marked PASS only from a
fresh run; cloud-facing checks remain NOT RUN where credentials/resources are
intentionally absent.

<!-- VALIDATION_RESULTS_START -->
| Command | Result |
| --- | --- |
| `terraform fmt -recursive infrastructure` | PASS; formatting applied only to Terraform files |
| `terraform fmt -recursive -check infrastructure` | PASS |
| `terraform -chdir=infrastructure/environments/staging init -backend=false -input=false` | PASS; reused pinned AWS provider 6.54.0; no backend or AWS resource contacted |
| `terraform -chdir=infrastructure/environments/staging validate` | PASS |
| `terraform -chdir=infrastructure/environments/production init -backend=false -input=false` | PASS; reused pinned AWS provider 6.54.0; no backend or AWS resource contacted |
| `terraform -chdir=infrastructure/environments/production validate` | PASS |
| `tflint --chdir=infrastructure --recursive --format=compact` | PASS; zero finding |
| `%TEMP%/247-home-cfn-lint/bin/cfn-lint.exe infrastructure/backend/bootstrap/backend.template.yaml` | PASS with cfn-lint 1.53.0 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS; 18 files, 64 tests |
| `pnpm test:integration` | PASS; 7 files, 53 PostgreSQL integration tests |
| `pnpm test:migration` | PASS; valid upgrade and invalid-history rejection/rollback |
| `pnpm test:e2e` | PASS; 14 Playwright tests, one worker, no manual retry |
| `pnpm build` | PASS; Next.js 16.2.10 production build |
| Backend parameter example JSON parse | PASS for staging and production examples |
| Repository secret-pattern scan | PASS; no AWS access-key/private-key pattern found |
| `git diff --check` | PASS; no whitespace error |
| Scoped Terraform state/plan artifact scan under `infrastructure/` | PASS; no `.tfstate` or `.tfplan` file found |
| `python -m cfnlint ...` | FAILED as a tool invocation because cfn-lint 1.53.0 has no package `__main__`; rerun through its installed executable passed |
| `terraform plan` | NOT RUN; real account/backend/OIDC/domain inputs and authorization are absent |
| `terraform apply` | NOT RUN; explicitly prohibited |

`cfn-lint` was installed only under `%TEMP%/247-home-cfn-lint`; no project or
global dependency was added. The local PostgreSQL Docker service was already
healthy. No database reset, volume removal or production database action was
performed. An initial whole-worktree recursive artifact scan timed out while
traversing dependency output; it was replaced by the scoped infrastructure scan
shown above rather than being reported as a pass.
<!-- VALIDATION_RESULTS_END -->

## Human decisions required

Account ownership, budget, domain ownership, certificate issuance, canonical
GitHub repository, secret owners, database sizing, alert routing, WAF thresholds
and apply approval cannot be selected by repository code. The accountable owners
must provide and independently review them.

## Rollback and forward-fix

This task created no AWS resource and changed no database, so cloud rollback is
not applicable. Repository changes can be reverted as a reviewed code change.
After resources exist, use retained/versioned state and data-preserving
forward-fixes; do not reset databases, delete state, destroy retained buckets or
rotate secrets merely to undo a failed deployment.

## Final decision

**AWS DEPLOYMENT BLOCKED**

The next safe action is to close the missing-input checklist and perform the
account/backend/OIDC verification. It is not to run `terraform apply`.
