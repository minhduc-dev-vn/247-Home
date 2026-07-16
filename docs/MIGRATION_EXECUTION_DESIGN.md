# Migration Execution Design

Decision: **OPTION A, DEDICATED MIGRATION IMAGE**  
Status: **DESIGN READY, IMAGE/TASK NOT IMPLEMENTED OR RUN**  
Date: 2026-07-15

## 1. Decision

Migrations will run as a one-off ECS Fargate task in private application subnets.
They will not run during application startup. A dedicated migration image is
built from the same immutable Git commit as the runtime image.

A private general-purpose runner was rejected as the primary path because it
adds patching, credential and workspace-residue concerns. A controlled runner
may remain an emergency recovery tool under database-owner approval.

## 2. Migration artifact contract

The migration image contains only what `prisma migrate deploy` needs:

- pinned Node.js and pnpm versions;
- frozen production/development dependencies needed by Prisma CLI;
- `prisma/schema.prisma` and committed migrations;
- package manifest and lockfile;
- no application/environment secret.

It is built from the same release commit, scanned, SBOM-attested and published by
digest to ECR. The release record links runtime and migration digests to one Git
SHA and migration-manifest checksum.

The existing standalone runtime image intentionally remains minimal and is not
used for migration.

## 3. Execution boundary

- ECS `RunTask` in private subnets with no public IP.
- Migration security group can reach RDS 5432 and approved HTTPS endpoints only.
- Execution role pulls the image and injects only the migration database secret.
- Migration task role reads only that secret/KMS key.
- Task uses `migration_user`; it cannot read Auth/S3/SES secrets.
- Desired application writes are drained or blocked when the migration runbook
  requires it.
- One release migration runs at a time through GitHub environment concurrency
  plus the Terraform/deployment lock.

## 4. Release sequence

```text
Verify release/migration checksum
  -> create RDS snapshot and wait until available
  -> drain writes when required
  -> ECS RunTask migration image by digest
  -> prisma migrate deploy
  -> verify _prisma_migrations and database invariants
  -> start/update application tasks by runtime digest
  -> readiness and smoke/E2E checks
```

The migration task must exit non-zero on Prisma failure. Application deployment
does not start until task exit is zero and database verification passes.

## 5. Validation after migration

- committed and applied migration checksums match;
- no failed/pending `_prisma_migrations` row;
- PostgreSQL constraints, exclusion constraints and required indexes validate;
- inventory allocations and appointment capacity invariants pass;
- UTC/TLS remain active;
- runtime role still has required DML and no DDL;
- `/api/ready`, auth, checkout and Operations smoke tests pass.

## 6. Failure and rollback

1. Keep the failed database and task logs for audit.
2. Do not edit Prisma migration history manually.
3. Keep application writes stopped when schema/data may be inconsistent.
4. Restore the snapshot into an isolated database for diagnosis.
5. Test a forward fix against both previous-head and clean databases.
6. Prefer application rollback to a schema-compatible digest; database recovery
   is forward-fix or isolated restore, never destructive reverse SQL.

## 7. Required repository work before execution

- [ ] Add and review a dedicated migration Docker target/file.
- [ ] Add a migration ECS task definition using the existing migration role and
      security group.
- [ ] Add a protected workflow job that snapshots, runs/waits for the task and
      validates output through OIDC.
- [ ] Prove the task has no application secrets or public network address.
- [ ] Run migration upgrade and failure drills in staging.

## 8. Exit criteria

The execution strategy is operationally ready only after the migration image and
task definition exist, their digests are recorded, a real staging migration and
failure drill pass, and database/release owners approve the evidence.
