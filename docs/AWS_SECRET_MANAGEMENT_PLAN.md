# AWS Secret Management Plan

Status: **STRATEGY READY, SECRET VALUES NOT CREATED**  
Date: 2026-07-15

## 1. Principles

- Terraform creates `aws_secretsmanager_secret` definitions only.
- Secret versions are populated after foundation creation through a protected,
  audited workflow.
- No value is committed, supplied as a Docker build argument, printed in a plan
  log or stored as a GitHub secret when workload identity is available.
- Staging and production use different KMS keys and secret namespaces.
- Human read access is break-glass and time-bound.

## 2. Secret definitions

| Definition | Runtime mapping | Format / owner |
| --- | --- | --- |
| `DATABASE_URL` | `DATABASE_URL` | PostgreSQL URL for environment runtime role, `sslmode=require`; database owner |
| `AUTH_SECRET` | `NEXTAUTH_SECRET` | At least 32 random bytes encoded safely; identity owner |
| `AUTH_URL` | `NEXTAUTH_URL` | Canonical HTTPS URL; platform owner |
| `APP_ORIGIN` | `APP_ORIGIN` | Canonical allowed HTTPS origin; platform owner |
| `STORAGE_CONFIG` | Not required for native AWS S3 | Reserved for reviewed non-secret endpoint metadata; storage owner |
| `SES_CONFIG` | Not injected until mail adapter exists | Sender/domain/provider metadata; identity owner |

`AUTH_URL` and `APP_ORIGIN` are configuration, not credentials, but remain in the
approved secret namespace to keep runtime injection uniform and prevent
environment drift.

The CloudFront origin-verification header is a sensitive Terraform input rather
than an application secret. It is protected in encrypted remote state and is not
printed or committed.

## 3. Access matrix

| Identity | Database URL | Auth values | Storage config | SES config |
| --- | --- | --- | --- | --- |
| ECS execution role | Inject runtime values | Inject | If used | If used |
| ECS application role | Read only if runtime provider requires | Read only if required | Read only if required | Read after adapter approval |
| Migration role | Migration `DATABASE_URL` only | Denied | Denied | Denied |
| GitHub release role | Denied direct value read | Denied | Denied | Denied |
| Human operator | Break-glass | Break-glass | Break-glass | Break-glass |

Runtime and migration database URLs must be separate secret definitions or
versions with separate IAM access. The existing generic Terraform definition is
not permission to reuse one credential.

## 4. Creation workflow

1. Verify the AWS account and KMS key.
2. Generate credentials in an approved ephemeral session or database bootstrap
   runner.
3. Submit the value directly to Secrets Manager without shell history, command
   logging or CI output.
4. Record only secret ARN/name and version ID.
5. Start one staging task and verify readiness/auth/storage behavior.
6. Scan application, ALB and CI logs for canary leakage.
7. Enable the remaining tasks after validation.

Terraform state must never receive application secret values through
`aws_secretsmanager_secret_version` or variable interpolation.

## 5. Rotation

| Secret | Routine trigger | Emergency effect |
| --- | --- | --- |
| Runtime DB credential | Approved schedule and personnel change | Revoke old login after new tasks pass |
| Migration DB credential | Per release window or short-lived issuance | Revoke immediately after migration |
| `AUTH_SECRET` | Security incident or planned session reset | Invalidates active sessions; communicate and monitor |
| Origin header | Exposure or ingress change | Update CloudFront and ALB atomically through reviewed Terraform |
| SES credential/config | Provider/domain change | Task role preferred; no SMTP static key without review |

Rotation uses a bounded overlap only where the protocol supports it. Old values
are disabled after verification, not retained indefinitely as fallback.

## 6. Audit and detection

- Enable CloudTrail management events for Secrets Manager and KMS.
- Alert on secret deletion, policy change, KMS disable/schedule deletion and
  unusual `GetSecretValue` calls.
- Redact secret ARNs only when their names reveal sensitive business context;
  values are always redacted.
- Review ECS task-definition revisions for accidental plaintext environment
  values.
- Confirm no static AWS credential names exist in production task definitions.

## 7. Recovery

Secrets use a 30-day recovery window. Suspected exposure is handled by creating
a replacement, updating consumers, validating, revoking the old credential and
reviewing CloudTrail. Canceling deletion is not a substitute for rotation.

## 8. Exit criteria

Secret management is operationally ready only after real definitions/KMS keys
exist, owners and rotation dates are assigned, runtime/migration credentials are
separate, canary leakage tests pass and break-glass access is exercised.
