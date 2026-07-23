# Staging Recovery Drill Record

## Status

**NEEDS REVIEW - NOT EXECUTED**

AWS credentials, provisioned staging outputs, RDS identifiers, ECR registry
access and an approved maintenance window were not available on 2026-07-23.
Therefore no RDS restore, ECS rollback, HTTPS, Secrets Manager, S3 lifecycle, or
alarm-delivery claim is made.

The immutable staging tag `v0.1.0-staging-p0.1` was exercised in GitHub Actions
run
[`30017223927`](https://github.com/minhduc-dev-vn/247-Home/actions/runs/30017223927).
Its complete quality job passed, then the artifact job stopped at the reviewed
AWS binding preflight because `AWS_REGION`, `AWS_ROLE_ARN`, and
`ECR_REPOSITORY_URL` were not configured. The deployment and recovery jobs
therefore made no AWS API calls. The redacted execution record is
`docs/evidence/p0/STAGING_EXECUTION_ATTEMPT_20260723.txt`.

## Prepared Controls

- `scripts/create-rds-pre-migration-snapshot.ps1` creates and waits for a
  pre-migration snapshot.
- `scripts/run-ecs-migration-task.ps1` runs migration/invariant tasks in private
  subnets and checks their exit code.
- `scripts/rollback-ecs-runtime.ps1` requires an immutable digest and explicit
  schema-compatibility approval.
- `.github/workflows/staging-release.yml` publishes runtime and migration
  artifacts from one Git SHA, deploys by digest, takes a snapshot, applies
  forward migrations, checks invariants and runs staging tests.

## Required Drill

1. Record current and previous ECR digests, schema head and release SHA.
2. Create the pre-migration snapshot and record its ARN.
3. Restore it to an isolated RDS instance.
4. Run migrations and `verify:database-invariants` against the restored copy.
5. Compare row counts and critical constraints without changing production.
6. Confirm the previous runtime digest is schema-compatible.
7. Execute rollback by digest, then validate health, auth, catalog, order reads,
   Operations and evidence authorization.
8. Restore the target digest and repeat smoke checks.
9. Record RTO/RPO, CloudWatch log links, operator and approver.

Never reset, truncate, reverse-migrate, or overwrite the source database during
the drill.
