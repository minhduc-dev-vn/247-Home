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

### Password-reset outbox migration

`20260728120000_identity_password_reset_outbox` is additive: it creates a
delivery-status enum and `password_reset_deliveries` with one-to-one token
linkage, a bounded-worker index and a non-negative attempts check. It does not
delete, backfill or alter existing reset-token rows. The new application rejects
legacy rows without a confirmed delivery record, so users with an older link
must request a new one.

Before a shared-environment migration, verify a backup exists and the runtime
secret store has the approved mailer configuration. After migration, verify the
new table/index/foreign key, no failed migration rows, and an isolated synthetic
delivery through the worker. Do not roll back the database by dropping the enum
or table. An application downgrade to pre-outbox reset code is unsafe; disable
password recovery and apply a forward fix instead.

Development seed is allowed only in an isolated acceptance database. Run it
twice and compare critical counts to prove idempotency. Never seed production.

## Unpaid order expiry maintenance

Order expiry is an explicit, bounded MANAGER/ADMIN operation; it is not a
database trigger, a hidden TTL, or an unattended cron job. It is for old
`PENDING_CONFIRMATION` orders whose inventory remains `RESERVED` and whose
payment is not `PAID` or `REFUNDED`.

1. Confirm the target is staging or the approved production database, record
   the release SHA and take/confirm a provider-managed backup. Do not run this
   operation against a local shell's accidental `DATABASE_URL`.
2. Obtain the active approved MANAGER/ADMIN user CUID through the approved
   administrative process. Do not place it, a password, or a connection string
   in a shell history, ticket, or Git file.
3. Review the bounded candidate count first. The cutoff must be explicit UTC
   ISO-8601; `--limit` is 1 to 100 and defaults to 25.

```powershell
pnpm orders:expire -- --actor-id <manager-or-admin-cuid> --before 2026-07-29T00:00:00Z --dry-run
```

4. After Operations approval, execute the same command without `--dry-run` and
   supply a human-readable reason:

```powershell
pnpm orders:expire -- --actor-id <manager-or-admin-cuid> --before 2026-07-29T00:00:00Z --limit 25 --reason "Approved unpaid-order expiry run INC-123"
```

Each candidate is handled in its own PostgreSQL transaction. A successful run
conditionally moves the order to `CANCELLED`, releases `RESERVED` inventory and
appointment capacity once, handles eligible unpaid payment/session state, and
writes `order.expire` audit. The command emits aggregate counts only; it does
not print order data. Exit `2` means candidates were skipped due to a race or a
now-invalid policy state. Exit `1` means stop and investigate an unexpected
failure; do not repeatedly rerun it to mask an inventory, slot, or audit error.

There is no database rollback that re-reserves a cancelled order. To correct a
bad expiry, preserve audit evidence, restore only through the approved
incident/forward-fix process, and require a new customer checkout for stock.
Customer notification is an Operations/support action until a separate
notification design is approved.

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
