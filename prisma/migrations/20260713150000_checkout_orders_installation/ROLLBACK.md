# Checkout, orders, and installation rollback and forward-fix

Orders, payments, item price snapshots, inventory reservations, carts, slots, and
appointments are business history. Do not drop or truncate these tables and do
not blanket-release inventory or slot capacity to roll back application code.
Retain the schema and use a compatible application rollback or an additive
forward migration.

For a partial deployment, inspect `_prisma_migrations` and all affected tables
before resolving migration state. Back up business data before an approved data
correction. Verify order totals against item snapshots, payment/order ownership,
inventory counters, and appointment/slot foreign keys after recovery.
