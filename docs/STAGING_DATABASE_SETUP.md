# Staging Database Setup

## Provisioning contract

Provision a managed PostgreSQL 16 instance in the private staging network with
TLS required, UTC timezone, encryption at rest, automated backups and audit
logs. Create separate identities:

- owner/operator: break-glass administration only;
- migration role: schema DDL and migration-table access, unavailable to app;
- runtime role: connect and CRUD only on application schema, no role/database
  creation and no migration DDL.

Store both URLs in the approved secret manager. The release workflow receives
only the migration URL; the application receives only the runtime URL.

## Safe migration procedure

1. Record source/target database identifiers, release SHA/digest and operator.
2. Drain writes and take a custom-format, encrypted backup.
3. Restore that backup into an isolated database and verify it is readable.
4. Inject the migration URL into the protected deployment job.
5. Run `pnpm db:migrate`; never reset, push-force, drop, truncate, or edit an
   applied migration.
6. Inspect `_prisma_migrations` for all committed migrations exactly once and no
   failed row.
7. Start the selected digest with the runtime URL and require `/api/ready` 200.

## Post-migration invariants

Verify with the DB owner and retain redacted output:

- all foreign keys/check constraints are validated;
- `technician_assignments_no_active_overlap` exists and is validated;
- Operations timestamp-ordering constraints are validated;
- inventory satisfies `0 <= reserved <= on_hand`;
- every active reserved order item has one matching RESERVED allocation;
- inventory reserved totals equal RESERVED allocation totals by variant;
- active appointment counts do not exceed slot capacity;
- required indexes from all committed migrations exist;
- fixture namespaces are absent from shared staging.

Run `pnpm test:migration` against its isolated test databases before release;
do not point that destructive fixture setup at shared staging.

## Backup and restore evidence

Record encrypted backup location, SHA-256, size, migration head, retention,
operator and isolated restore result outside Git. Restore into a new database,
compare migration rows, constraints, indexes and representative business row
counts, then run invariants and readiness. A `pg_restore --list` check alone is
not a restore drill.

No staging database credential is available in the current environment, so no
real staging migration, backup or restore has been executed by this task.

