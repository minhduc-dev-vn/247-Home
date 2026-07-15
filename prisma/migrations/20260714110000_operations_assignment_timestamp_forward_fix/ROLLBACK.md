# Forward-Only Note

This migration is additive/corrective and uses an explicit transaction. On validation failure, PostgreSQL rolls back the migration. Do not delete assignments, clear timestamps, drop enum values, or reset the database.

For contradictions, inspect source history and ship an audited forward correction before retrying. After success, leave `assigned_at`, `arrived_at`, and the validated ordering constraint in place even if the application is rolled back. Verify `convalidated = true`, zero invalid rows, unchanged row counts, and unchanged known lifecycle timestamps. See `docs/OPERATIONS_MIGRATION_RUNBOOK.md`.
