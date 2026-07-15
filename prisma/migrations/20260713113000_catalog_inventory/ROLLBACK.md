# Catalog and inventory rollback and forward-fix

Do not drop catalog, inventory, service-area, image, or audit rows after business
data exists. A code rollback must keep the schema and stop exposing incompatible
mutations. Correct constraints, indexes, or enum behavior with a new forward
migration instead of editing an applied migration.

For a partial deployment, inspect `_prisma_migrations` and each created object
before resolving state. Verify product/variant foreign keys, non-negative money
and inventory checks, unique SKU/slug constraints, and audit-row retention.
