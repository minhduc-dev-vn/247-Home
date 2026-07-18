# Warranty create idempotency migration

- Forward-only expand migration. It does not update, delete, or reinterpret historical warranty rows.
- Legacy rows keep both idempotency columns null. New application writes always populate both SHA-256 values.
- The partial unique index serializes retries per customer without manufacturing keys for historical data.
- The lifecycle constraint is replaced in place so a customer can close either a resolved or rejected request while retaining the corresponding terminal timestamp.
- Expected lock is limited to two metadata column additions, one check constraint, and one concurrent-size index build performed by the migration. Schedule normal migration monitoring for a large production table.
- If a partial deploy occurs, inspect the columns, constraint, and index before using `prisma migrate resolve`. Do not reset the database.
- Rollback is a forward fix that first disables new warranty creates, verifies no replay traffic depends on these columns, then removes the index/constraint/columns in a separately reviewed migration. No warranty data should be deleted.
