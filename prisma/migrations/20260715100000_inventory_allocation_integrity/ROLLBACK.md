# Inventory Allocation Integrity Migration

This migration is forward-only. Do not drop the ledger or delete order items to
roll back an application release.

- Historical `CONSUMED` and `RELEASED` allocations are derived from immutable
  order snapshots. Historical `RESERVED` rows are backfilled only when their
  per-variant total exactly equals `inventory.reserved`.
- A warning named `INVENTORY_ALLOCATION_RECONCILIATION_REQUIRED` means the
  affected legacy orders are intentionally blocked from inventory-consuming
  transitions. Reconcile those rows from source records through an audited
  forward fix; do not change counters merely to make the warning disappear.
- If deployment is partial, finish the additive table migration before
  deploying the application that writes allocations at checkout.
- Verify that every new order item has one allocation, every consumed order has
  only `CONSUMED` allocations, and the sum of open `RESERVED` allocations per
  variant equals `inventory.reserved` after legacy reconciliation.
