# Superseded Safety Note

This migration is already applied in at least one environment and its SQL/checksum must not be edited. Its `assigned_at DEFAULT CURRENT_TIMESTAMP` backfill is unsafe for progressed legacy assignments. The corrective path is `20260714110000_operations_assignment_timestamp_forward_fix` and `docs/OPERATIONS_MIGRATION_RUNBOOK.md`.

Do not drop ARRIVED, timestamp columns, service-area mappings, or assignment data. If this migration failed, apply the reviewed idempotent forward-fix SQL, verify the data and constraint, then reconcile migration history. Never hide a contradictory timestamp sequence by replacing known history.
