# Default Address Integrity Migration

This migration is forward-only. Do not delete addresses or drop the partial
unique index merely to roll back application code.

- If `ADDRESS_DEFAULT_HISTORY_INVALID` is raised, the migration transaction is
  rolled back without changing data. Determine the intended default from source
  history and apply an audited forward correction before retrying.
- If deployment is partial, leave the unique index in place; older application
  versions are compatible with the stronger invariant.
- Verify the index is valid in `pg_index` and that no active user has more than
  one row where `is_default = true` and `archived_at IS NULL`.
