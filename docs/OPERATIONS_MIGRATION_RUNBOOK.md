# Operations Migration Runbook

## Strategy

`20260713190000_operations_domain_integrity` is already recorded as applied in at least one environment. Its SQL and checksum must not be edited. H-03 is fixed with the forward-only migration `20260714110000_operations_assignment_timestamp_forward_fix`.

The forward fix is schema-idempotent so it can serve two paths:

1. Databases where `20260713190000` succeeded use normal `pnpm db:migrate`.
2. Databases still at `20260713173000`, or where `20260713190000` failed, apply the new SQL as a reviewed recovery patch before reconciling Prisma migration history.

The migration takes a `SHARE ROW EXCLUSIVE` lock on `technician_assignments`. Reads may continue, but assignment writes must be paused. Constraint validation scans the table. Schedule a maintenance window sized from a staging copy and take a verified backup before production execution.

## Backfill Rules

- Known `accepted_at`, `en_route_at`, `arrived_at`, `started_at`, and `completed_at` values are never moved or deleted.
- `assigned_at` becomes the earliest trustworthy value among the existing lifecycle timestamps, `created_at`, and `updated_at`.
- Legacy rows with `started_at` but no `arrived_at` receive `arrived_at = started_at`. Before ARRIVED existed, `started_at` was the known arrival/start boundary, so this preserves ordering without inventing elapsed time.
- Contradictory known history fails with `OPERATIONS_TIMESTAMP_HISTORY_INVALID`. It is not silently normalized.
- The ordering check is added as `NOT VALID`, then explicitly validated after backfill.

## Deployment Paths

### Existing migration succeeded

1. Back up and pause assignment mutations.
2. Run `pnpm db:migrate`.
3. Run the verification queries below.
4. Resume writes only after validation succeeds.

### Existing migration has not run

The old migration can fail before Prisma reaches the forward fix. In a reviewed maintenance window:

1. Back up the database and confirm the last applied migration is `20260713173000_operations_schedule_and_reschedule`.
2. Apply `20260714110000_operations_assignment_timestamp_forward_fix/migration.sql` with `prisma db execute --file ...` against the intended environment.
3. Verify data and constraint state using the queries below.
4. Mark `20260713190000_operations_domain_integrity` as applied because the recovery SQL reproduces its schema effects.
5. Mark `20260714110000_operations_assignment_timestamp_forward_fix` as applied because its SQL was applied directly.
6. Run `prisma migrate status`, then normal `prisma migrate deploy` for later migrations.

Both `prisma migrate resolve --applied` commands require explicit environment review. Never run this procedure against production from an agent session.

### Existing migration failed

1. Stop and inspect `_prisma_migrations.logs`; do not delete its row.
2. Confirm whether PostgreSQL rolled back all statements or left partial schema effects.
3. Apply the idempotent forward-fix SQL directly. If it reports contradictory history, correct only source-supported timestamps through an audited forward fix and rerun.
4. Verify schema/data, then reconcile the failed migration and forward fix with `prisma migrate resolve --applied`.
5. Run `prisma migrate status` before resuming deployment.

## Verification

```sql
SELECT conname, convalidated
FROM pg_constraint
WHERE conrelid = 'technician_assignments'::regclass
  AND conname = 'technician_assignments_timestamp_order';

SELECT COUNT(*) AS invalid_rows
FROM technician_assignments
WHERE (accepted_at IS NOT NULL AND accepted_at < assigned_at)
   OR (en_route_at IS NOT NULL AND en_route_at < COALESCE(accepted_at, assigned_at))
   OR (arrived_at IS NOT NULL AND (en_route_at IS NULL OR arrived_at < en_route_at))
   OR (started_at IS NOT NULL AND (arrived_at IS NULL OR started_at < arrived_at))
   OR (completed_at IS NOT NULL AND (started_at IS NULL OR completed_at < started_at));
```

Record row counts and timestamp checksums before and after migration. The expected results are `convalidated = true`, `invalid_rows = 0`, unchanged assignment count, and unchanged known lifecycle timestamps.

## Rollback And Forward Fix

- Do not roll back by deleting rows, dropping enum values, resetting the database, or removing timestamp columns.
- If the migration fails, its explicit transaction rolls back. Investigate the reported contradictions and ship an audited data correction before retrying.
- If application rollback is required after migration success, leave the additive schema and validated constraint in place; deploy application compatibility as a forward fix.
- For a partially deployed migration, follow the failed-migration path above. Do not edit the checksum of an applied migration.
- The migration upgrade harness is `pnpm test:migration`; it uses isolated PostgreSQL 16 containers backed by `tmpfs` and never connects to the configured application database.
