# 247 Home AWS infrastructure

Status: **INFRASTRUCTURE CODE READY**. No AWS resource has been created.

This directory implements the approved architecture in
`docs/CLOUD_DEPLOYMENT_ARCHITECTURE.md` as reviewable Terraform. It deliberately
does not contain credentials, secret values, state, plans, DNS changes, or an
automatic `terraform apply` workflow.

## Structure

```text
infrastructure/
|-- terraform/                 # CLI version contract
|-- modules/
|   |-- platform/              # shared composition used by both roots
|   |-- networking/            # VPC, three subnet tiers, routes, NAT, S3 endpoint
|   |-- security/              # KMS and security groups
|   |-- ecr/                   # immutable image registry
|   |-- ecs/                   # ALB, task definition, Fargate service/autoscaling
|   |-- rds/                   # PostgreSQL 16
|   |-- s3/                    # private evidence/assets bucket
|   |-- iam/                   # task, migration, and GitHub OIDC roles
|   |-- secrets/               # secret definitions without values
|   |-- cloudfront/            # CDN and HTTPS edge
|   |-- waf/                   # managed and rate rules in count-first mode
|   `-- monitoring/            # logs, alarms, and task-stop notifications
|-- environments/
|   |-- staging/
|   `-- production/
`-- backend/                   # CloudFormation remote-state bootstrap + examples
```

Staging and production are thin roots over `modules/platform`; they do not copy
the resource graph.

## Safety contract

- Never commit real `.tfvars`, backend values, plans, or state.
- Generate the CloudFront origin-verification value outside Git. It is a
  sensitive Terraform input and is therefore protected by the encrypted remote
  state access boundary.
- Never use a mutable image tag. `container_image` requires
  `repository@sha256:<64 hex characters>`.
- `enable_ecs_service` defaults to `false`. Do not enable it until all required
  Secrets Manager definitions have an `AWSCURRENT` version and the release
  digest has passed staging.
- Do not run `terraform apply` from a workstation. The future apply procedure
  requires a protected environment, approved plan, short-lived identity and a
  second operator.
- Terraform creates no application secret value. RDS manages its initial master
  credential in Secrets Manager; the runtime and migration database users are
  provisioned separately under `docs/DATABASE_RUNBOOK.md`.
- S3, RDS and KMS resources use `prevent_destroy` or deletion protection. Removal
  requires a reviewed code change and data-retention decision.

## Local validation

Install the version recorded in `terraform/.terraform-version`, then run:

```powershell
terraform fmt -recursive -check infrastructure

terraform -chdir=infrastructure/environments/staging init -backend=false
terraform -chdir=infrastructure/environments/staging validate

terraform -chdir=infrastructure/environments/production init -backend=false
terraform -chdir=infrastructure/environments/production validate

tflint --chdir=infrastructure --init
tflint --chdir=infrastructure --recursive
```

`init -backend=false` downloads providers only. It does not contact an AWS
backend or create resources.

## Future plan workflow

1. Bootstrap an encrypted, versioned state bucket and lock table in each AWS
   account using the controls in `backend/README.md`.
2. Copy the environment `terraform.tfvars.example` to an encrypted path outside
   Git and replace every placeholder. Keep `enable_ecs_service=false`.
3. Initialize with the protected backend configuration.
4. Run `terraform plan -out=<protected-plan>` through the approved OIDC role and
   review resource, IAM and cost changes. Do not expose the plan as a public CI
   artifact because it can contain sensitive values.
5. After an authorized foundation apply, populate the secret values out of band,
   bootstrap database roles, publish the immutable image and validate the
   migration path.
6. Set `enable_ecs_service=true`, create a new reviewed plan, then apply only
   after all staging or production gates are approved.
7. Create Route 53 aliases to the CloudFront output only after ingress, WAF,
   cookies and direct-ALB denial have passed.

## Secret contracts

The `secrets` module creates definitions only:

| Secret           | Expected value                                             | ECS mapping                                       |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL URL for the least-privilege runtime user        | `DATABASE_URL`                                    |
| `AUTH_SECRET`    | At least 32 random characters                              | `NEXTAUTH_SECRET`                                 |
| `AUTH_URL`       | Canonical environment HTTPS URL                            | `NEXTAUTH_URL`                                    |
| `APP_ORIGIN`     | Canonical allowed HTTPS origin                             | `APP_ORIGIN`                                      |
| `STORAGE_CONFIG` | Bucket/region and optional custom-endpoint credential pair | JSON-key injection for application storage config |
| `SES_CONFIG`     | JSON object for the future production mail adapter         | Not injected until the application adapter exists |

Native AWS S3 uses the AWS SDK default credential provider chain and therefore
the ECS application task role. `STORAGE_ACCESS_KEY` and `STORAGE_SECRET_KEY` are
optional and are accepted only as a complete pair for an explicitly configured
custom endpoint in local/test environments. Terraform creates no IAM user or
access key and does not inject either variable into ECS.

CloudFront connects to the ALB through `alb_origin_domain_name`, a
project-owned DNS name such as `origin-staging.<root-domain>`. The regional ALB
certificate must cover that name; the `us-east-1` CloudFront certificate covers
the customer-facing aliases. See `docs/DOMAIN_CERTIFICATE_PLAN.md`.

## Environment differences

| Setting                     | Staging                          | Production                                     |
| --------------------------- | -------------------------------- | ---------------------------------------------- |
| ECS                         | 1 task, no autoscaling           | 2-6 tasks                                      |
| RDS                         | Single-AZ, 7-day backup          | Multi-AZ, 35-day backup                        |
| NAT                         | One gateway                      | One gateway per AZ                             |
| Logs                        | 30 days                          | 90 days                                        |
| S3 noncurrent versions      | 90 days                          | 365 days                                       |
| ECR retained release images | 30                               | 100                                            |
| WAF                         | Managed/rate rules in count mode | Count mode until Security approves enforcement |

See `docs/AWS_INFRASTRUCTURE_AS_CODE.md` for the architecture mapping and future
deployment procedure.
