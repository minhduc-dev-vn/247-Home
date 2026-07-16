# AWS Infrastructure as Code

Status: **INFRASTRUCTURE CODE READY**  
Date: 2026-07-15  
Deployment status: **NOT DEPLOYED**

## 1. Architecture mapping

The Terraform implementation follows
[CLOUD_DEPLOYMENT_ARCHITECTURE.md](./CLOUD_DEPLOYMENT_ARCHITECTURE.md) without
changing the Next.js modular monolith, PostgreSQL design, business logic or
release artifact contract.

| Approved capability | Terraform implementation |
| --- | --- |
| AWS Singapore primary region | Environment provider defaults to `ap-southeast-1`; not hardcoded in modules |
| Two-AZ network | `modules/networking` creates public, private application and private database subnets in two or three supplied AZs |
| CloudFront and WAF | `modules/cloudfront`, plus `modules/waf` through a required `us-east-1` provider alias |
| HTTPS ALB origin | `modules/ecs` creates an ALB HTTPS listener using a referenced regional ACM certificate |
| Private Fargate | ECS tasks use private subnets, no public IP, non-root UID, read-only root filesystem and a writable `/tmp` volume |
| PostgreSQL 16 | `modules/rds` creates private RDS PostgreSQL 16 with TLS, UTC, encryption, backups and environment-specific Multi-AZ |
| Private object storage | `modules/s3` creates an SSE-KMS, versioned, TLS-only bucket with all public access blocked |
| Immutable OCI release | `modules/ecr` creates an encrypted, scan-on-push, immutable-tag repository; ECS accepts only a digest reference |
| Managed secrets | `modules/secrets` creates definitions only; no `aws_secretsmanager_secret_version` is committed |
| Least-privilege identities | `modules/iam` separates execution, application, migration and GitHub OIDC roles |
| Monitoring | `modules/monitoring` provides encrypted application logs, SNS alarms and ECS task-stop events |

No Route 53 record or certificate is created implicitly. The account/domain
owner supplies reviewed ACM certificate ARNs, and DNS cutover occurs only after
the deployed CloudFront distribution has passed the release gates.

## 2. Module explanation

### Platform composition

`modules/platform` is the only full stack composition. Staging and production
call it with different capacity, retention and availability inputs. This keeps
the resource graph identical while preventing environment data and state from
being shared.

### Networking and security

- Public subnets contain only ALB and NAT gateways.
- Private application subnets contain ECS tasks.
- Private database subnets contain RDS and have no internet route.
- ALB port 443 accepts only the AWS-managed CloudFront origin-facing prefix list.
- The ALB listener defaults to 403 and forwards only when CloudFront supplies the
  high-entropy `X-Origin-Verify` header.
- ECS port 3000 accepts only the ALB security group.
- RDS port 5432 accepts only ECS and migration security groups.
- The only `0.0.0.0/0` security-group egress is TCP 443 for controlled AWS/public
  APIs. There is no public ingress to ECS or PostgreSQL.
- Staging has one NAT gateway. Production has one per AZ to avoid a single-AZ
  egress dependency. S3 uses a gateway endpoint.

### IAM

- **ECS execution role:** ECR pull/log permissions from the AWS managed execution
  policy, plus scoped Secrets Manager read and KMS decrypt for task injection.
- **ECS application role:** evidence-prefix S3 operations, KMS use, scoped secret
  read and SES send for the supplied identity.
- **Migration role:** reads only the migration database secret. SQL privileges
  are enforced by the database credential, not IAM policy.
- **GitHub Actions OIDC role:** accepts `sts.amazonaws.com` and exact supplied
  `sub` claims. It publishes ECR images and invokes the reviewed release actions
  without an AWS access key.

The GitHub subject is an input because GitHub's current OIDC format may include
immutable owner/repository IDs. The value must be copied from the actual token
contract, not guessed from a repository name.

### Data services

RDS manages the initial master password in Secrets Manager. Terraform never
receives it. The database still needs separate runtime and migration roles, as
required by [DATABASE_RUNBOOK.md](./DATABASE_RUNBOOK.md). `prevent_destroy`, RDS
deletion protection, final snapshots and S3 versioning make accidental data
removal fail closed.

The assets bucket is private and has no website endpoint or public policy. The
application role is scoped to `installation-evidence/*`. Product-image
production storage remains an application launch gate already recorded in the
cloud architecture.

## 3. Environment strategy

Each environment has its own root, state, AWS account, VPC, KMS keys, bucket,
database, secrets and roles.

| Control | Staging | Production |
| --- | --- | --- |
| CIDR | `10.47.0.0/16` | `10.48.0.0/16` |
| ECS desired/min/max | 1/1/1 | 2/2/6 |
| RDS | `db.t4g.small`, Single-AZ | `db.t4g.small`, Multi-AZ |
| Storage | 30 GiB, autoscale to 100 | 50 GiB, autoscale to 500 |
| Backup | 7 days | 35 days |
| Performance Insights | 7 days | 731 days |
| ALB deletion protection | Off | On |
| Service creation default | Off | Off |

Bucket names requested by the architecture are examples of globally unique S3
names. The account owner must confirm that `247-home-staging-assets` and
`247-home-production-assets` are available before planning; changing a name is
an environment input decision, not a module rewrite.

## 4. Security model

1. **No static CI credential.** GitHub uses OIDC and protected environment
   subjects. Real subject claims require human verification.
2. **No application secret value in code.** Terraform creates Secrets Manager
   metadata only. Operators add application secret versions through a protected
   process after foundation creation. The CloudFront origin-verification value is
   a sensitive infrastructure input that is necessarily stored in encrypted
   Terraform state; state access is therefore privileged.
3. **No mutable image deployment.** Variable validation rejects tags without a
   SHA-256 digest.
4. **Private data plane.** ECS and RDS have no public IP. Security-group sources
   use group IDs rather than broad CIDRs.
5. **Encryption.** RDS, S3, ECR, Secrets Manager and application logs use KMS;
   WAF logs use CloudWatch service-managed encryption in `us-east-1` until a
   dedicated edge-region KMS key is approved.
6. **Count-first WAF.** AWS Common and Known Bad Inputs managed groups remain in
   count mode. Rate rules also default to count. Production enforcement requires
   false-positive evidence and Security approval.
7. **Destruction controls.** Stateful resources require an explicit reviewed
   code change before Terraform can destroy them.

Terraform plans and state are sensitive even when variables are marked
`sensitive`; they must use the encrypted backend and must not be uploaded as
public CI artifacts.

## 5. Deployment workflow

The future workflow preserves
[RELEASE_ARTIFACT_STRATEGY.md](./RELEASE_ARTIFACT_STRATEGY.md):

1. Trusted CI tests and builds one OCI image from an approved commit.
2. ECR receives the image once and records its digest. Tags are discovery labels.
3. A protected Terraform plan references the digest and is reviewed before any
   apply.
4. The foundation is created with ECS service disabled.
5. Secret values and database roles are provisioned through protected channels.
6. The migration job runs `prisma migrate deploy` from a private network using a
   separate credential and a pre-migration snapshot.
7. ECS service is enabled in staging. HTTPS, storage, database, rollback and E2E
   evidence are collected.
8. The identical image digest is replicated/promoted to the production account
   and referenced by the production task definition.
9. Production apply and DNS cutover require the launch-gate approval matrix.

The current standalone runtime image does not contain Prisma CLI or migrations,
so it is not a migration image. A reviewed private CI runner or dedicated
migration artifact from the same commit must be selected before deployment. The
Terraform migration role and network boundary are ready, but this task does not
invent a new application runtime.

## 6. Terraform usage

Validation without AWS access:

```powershell
terraform fmt -recursive -check infrastructure
terraform -chdir=infrastructure/environments/staging init -backend=false
terraform -chdir=infrastructure/environments/staging validate
terraform -chdir=infrastructure/environments/production init -backend=false
terraform -chdir=infrastructure/environments/production validate
tflint --chdir=infrastructure --init
tflint --chdir=infrastructure --recursive
```

Future initialization uses a protected backend file outside Git:

```powershell
terraform -chdir=infrastructure/environments/staging init `
  -backend-config=<protected-staging-backend-config>
```

Future plan command:

```powershell
terraform -chdir=infrastructure/environments/staging plan `
  -var-file=<protected-staging-tfvars> `
  -out=<protected-plan-path>
```

Do not run `apply` until the next section and every architecture launch gate are
approved.

## 7. Future apply procedure

### Foundation pass

- Verify AWS account ID, region and caller identity.
- Verify remote-state bucket, lock table, KMS policy and backup.
- Verify actual GitHub OIDC `aud` and immutable `sub` values.
- Verify both ACM certificates and S3 bucket-name availability.
- Generate the origin-verification header outside Git and place it only in the
  protected variable source.
- Set an immutable image digest, but keep `enable_ecs_service=false`.
- Run and review plan, IAM diff, security groups, monthly cost and destruction
  actions with two operators.
- Apply only from the protected platform workflow after approval.

### Secret and database bootstrap

- Populate each secret through Secrets Manager without Terraform.
- Create separate database migration/runtime roles and require TLS.
- Confirm Node and PostgreSQL use UTC.
- Verify native S3 access through the ECS task role and negative-test access to
  other buckets; no static storage key is injected.
- Create and verify a pre-migration snapshot.
- Execute migrations from the approved private migration runner.

### Service pass

- Set `enable_ecs_service=true` and review a new plan.
- Start staging, wait for ALB targets and `/api/ready`.
- Run storage authorization, ingress spoofing, Auth.js cookie, E2E and rollback
  tests against the exact digest.
- Review WAF count samples before any rule changes to `block`.
- Subscribe and confirm the alarm destination.
- Promote the same digest to production only after staging evidence is signed.

No command in this document is evidence of deployment. This repository task ran
format, initialization without backend, validation and lint only.

## 8. Known limitations and required human decisions

| Item | Status | Required decision |
| --- | --- | --- |
| AWS accounts and backend bootstrap | External blocker | Create separate staging/production accounts and protected state stores |
| ACM and DNS | External blocker | Prove domain ownership and supply real certificate ARNs |
| GitHub OIDC subjects | External blocker | Confirm actual immutable subject claims and environment protection |
| Secret versions | Deliberately absent | Populate through approved secret workflow before ECS starts |
| S3 ambient task credentials | Repository remediation complete | Verify ECS task-role access and denial in the real target account; Terraform creates no access key |
| Migration execution artifact | Release blocker | Approve private runner or dedicated artifact from the same commit |
| Password-reset SES adapter | Application launch blocker | Implement and validate adapter before production |
| Product-image storage | Application launch blocker | Complete the approved private storage path before production |
| WAF enforcement thresholds | Security approval required | Use measured count-mode evidence; do not enable aggressive blocking by default |
| Real plan and cost | Not run | Run only with approved account inputs and short-lived identity |

The infrastructure code is reproducible and validated. The system is not
deployed and must not be described as production ready until these decisions and
the cloud architecture launch gates are closed.
