# Customer warranty migration notes

- Strategy: forward-only, expand and backfill. No table, enum, or historical row is removed.
- Existing requests are backfilled as `DEVICE` coverage because the previous schema did not record coverage type. The warranty start is `orders.completed_at`, falling back to `orders.created_at` only for legacy rows.
- The migration fails before constraints are added if an existing request cannot be linked to an order snapshot or if duplicate `(customer, order item, coverage)` rows exist. Resolve those rows through an approved forward-fix; do not delete or reset the database.
- A partially applied migration must be inspected with `prisma migrate status` and PostgreSQL catalog queries before using `prisma migrate resolve`. Never mark it applied without verifying every column, constraint, index, and table in this migration.
- Rollback is a forward migration that stops application writes and removes only newly added constraints/columns after evidence metadata and warranty snapshots have been exported. Dropping data is not an operational rollback.
- Post-deploy checks: validate constraints, compare request counts, verify no null snapshot fields, and exercise owner-scoped read/create on a non-production test account.
