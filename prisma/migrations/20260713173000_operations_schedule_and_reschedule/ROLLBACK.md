# Forward-Only Note

Do not remove schedule columns, delete overlapping assignments, drop `btree_gist`, or reset the database as rollback. If schedule backfill or the exclusion constraint fails, stop writes, identify missing/overlapping source rows, and correct them through an audited forward migration before retrying.

Verify non-null schedule ranges, `scheduled_end_at > scheduled_start_at`, and no active technician overlap. A partially deployed migration must be inspected and reconciled through the reviewed Prisma failed-migration workflow. See `docs/OPERATIONS_MIGRATION_RUNBOOK.md`.
