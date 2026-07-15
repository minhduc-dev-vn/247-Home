# Forward-Only Note

Do not roll back this migration by deleting technician, assignment, evidence, or warranty data, and do not drop its enums or tables. If a constraint or foreign key fails during deployment, preserve the failed migration record, inspect `_prisma_migrations.logs`, correct only source-supported data through an audited forward fix, and reconcile with `prisma migrate resolve` after review.

Verify table/row counts, foreign keys, unique active-assignment behavior, and application reads before resuming writes. See `docs/OPERATIONS_MIGRATION_RUNBOOK.md`.
