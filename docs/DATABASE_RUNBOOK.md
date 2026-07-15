# Database Runbook

Version: 2026-07-15

Scope: PostgreSQL 16 staging operations. Production access and production
migration remain outside this repository task.

## Roles and preconditions

- Use a dedicated migration role and a separate least-privilege runtime role.
- Confirm database identifier and environment with a second operator before any
  migration. Never infer staging from a local filename.
- Application and PostgreSQL use UTC.
- Record release commit, artifact digest, migration checksums, operator and
  maintenance window.
- Stop or drain application writes when an existing database requires migration.

Never use `prisma migrate reset`, destructive `db push`, `DROP DATABASE`,
`DROP SCHEMA`, truncate, volume deletion or production credentials.

## Backup

Create a PostgreSQL custom-format backup in encrypted, access-controlled storage
before migration:

```powershell
pg_dump --format=custom --no-owner --no-acl --file=<protected-path> $env:DATABASE_URL
pg_restore --list <protected-path>
Get-FileHash -Algorithm SHA256 <protected-path>
```

Record the checksum, byte size, migration head, retention date and owner. Dumps
must not enter Git, CI artifacts or unencrypted developer folders.

## Migration

```powershell
pnpm install --frozen-lockfile
pnpm db:migrate
```

Use `prisma migrate deploy` only. Review command output and
`_prisma_migrations`; all committed migrations must be applied exactly once and
none may remain pending. Do not edit a migration already applied anywhere
shared. Use a reviewed forward-fix migration.

## Verification

After migration, verify:

- migration count/checksums and no failed row;
- all foreign keys, uniqueness checks, Operations timestamp checks and
  technician overlap exclusion constraints are validated;
- required query indexes exist;
- unresolved inventory allocations are zero;
- inventory reserved quantities match active allocations;
- installation slot counters match active appointments;
- fixture namespaces are zero in a shared staging database;
- `/api/ready` succeeds using the runtime role.

Development seed is allowed only in an isolated acceptance database. Run it
twice and compare critical counts to prove idempotency. Never seed production.

## Restore drill

Restore to a newly created isolated database, never over the source:

```powershell
createdb <isolated-restore-database>
pg_restore --no-owner --no-acl --dbname=<isolated-restore-database> <protected-path>
```

Compare migration rows, constraints, indexes, users, products, orders, items,
allocations, appointments and assignments with the source. Re-run all inventory
and slot invariants. A readable dump manifest alone is not a successful restore.

## Failure handling

1. Stop writes and preserve the failed database unchanged.
2. Capture request IDs, migration output, PostgreSQL logs and
   `_prisma_migrations` without credentials or customer payloads.
3. Do not mark a failed migration applied or manually mutate history without
   database-owner review.
4. Restore the pre-migration backup into an isolated database for diagnosis.
5. Prepare and test a forward fix on both a clean database and a copy at the
   previous migration head.
6. Resume only after constraints, invariants, readiness and smoke tests pass.

## Rollback

Prefer application rollback to the previous schema-compatible immutable
artifact. Database rollback is restore/forward-fix based; do not delete enum
values, columns or business history to imitate reversal. When a restore is
required, keep the original failed database for audit, restore separately,
verify, then switch connectivity through the approved change process.

Migration-specific forward-fix and partial-deploy guidance remains in the
individual migration notes and `OPERATIONS_MIGRATION_RUNBOOK.md`.
