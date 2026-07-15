# Local Data Cleanup And Reconciliation Plan

Assessment date: 2026-07-15  
Scope: local Docker database `home247`; never production

## 1. Classification

Read-only inspection found six namespaces matching the exact Operations test
factory format `^ops[0-9a-f]{32}$`. Each has the deterministic factory shape of
9 users, 4 orders, 4 appointments, 1 assignment, 1 warranty and 1 namespace
audit row. All 24 legacy RESERVED order items without an allocation belong to
these six namespaces. They are **development/test residue**.

Three slot counter mismatches do not carry an Operations namespace. Two contain
repeated appointments owned by the documented local demo customer; one has a
counter but no appointment. They are local data, but their exact request
history cannot be inferred. They are **development reconciliation data**, not
safe candidates for automatic deletion or guessed counter updates.

The reused local database must never be promoted or restored into staging.
Staging validation uses a newly created database and deterministic seed.

## 2. Approved namespace cleanup

The cleanup helper validates the namespace regex and scopes deletes through
factory-owned users, products, areas, orders, appointments, assignments,
evidence and audit targets. It is repeatable and rejects arbitrary namespace
input.

Current residue command:

```powershell
pnpm cleanup:operations-fixtures -- ops236add70801040dda2c9d913338b3605 ops2a81e02b7fa54f79a0f4a7ecd509bd40 ops70bed400da3a4f67bee9bac2eef8508b ops7d1d561ed378424fbb61f1414f79a4a1 ops8245ceef4c31478691bcabba617477e5 opsdffd9edc540849ef8dc85865fc617f0f
```

Affected factory-owned tables:

`audit_logs`, `installation_evidence`, `warranty_requests`,
`checkout_attempts`, `cart_items`, `carts`, `technician_assignments`,
`installation_appointments`, `payments`, `inventory_allocations`,
`order_items`, `orders`, `installation_slots`, `technician_service_areas`,
`technicians`, `addresses`, `user_roles`, `users`, `inventory`,
`product_variants`, `products`, and `service_areas`.

The helper does not truncate a table and does not select non-namespace data.

## 3. Verification SQL

Run read-only checks before and after cleanup:

```sql
SELECT split_part(email, '.', 1) AS namespace, count(*)
FROM users
WHERE split_part(email, '.', 1) ~ '^ops[0-9a-f]{32}$'
GROUP BY 1 ORDER BY 1;

SELECT count(*) AS unresolved_reserved_items
FROM order_items item
JOIN orders purchase ON purchase.id = item.order_id
LEFT JOIN inventory_allocations allocation ON allocation.order_item_id = item.id
WHERE purchase.inventory_status = 'RESERVED' AND allocation.id IS NULL;

SELECT inventory.product_variant_id
FROM inventory
LEFT JOIN (
  SELECT product_variant_id, sum(quantity)::integer AS quantity
  FROM inventory_allocations WHERE status = 'RESERVED'
  GROUP BY product_variant_id
) allocation ON allocation.product_variant_id = inventory.product_variant_id
WHERE inventory.reserved <> coalesce(allocation.quantity, 0);

SELECT slot.id, slot.booked_count, count(appointment.id) AS active_appointments
FROM installation_slots slot
LEFT JOIN installation_appointments appointment
  ON appointment.installation_slot_id = slot.id
 AND appointment.status NOT IN ('CANCELLED', 'COMPLETED')
 AND appointment.capacity_released_at IS NULL
GROUP BY slot.id
HAVING slot.booked_count <> count(appointment.id);
```

## 4. Non-namespaced reconciliation

Do not alter the three mismatched slots automatically. A human owner must:

1. Confirm whether every local demo order may be discarded.
2. Export affected order, appointment, slot and audit identifiers before change.
3. Decide from source evidence whether to retain appointments and correct the
   counter, or cancel/remove disposable demo orders through a dedicated,
   reviewed local cleanup script.
4. Re-run all invariant SQL and record before/after counts.

Never invent `inventory_allocations`, rewrite order history, or set counters
only to make a check green.

## 5. Seed and staging rule

After namespace cleanup, run `pnpm db:seed` twice and verify that deterministic
demo rows remain idempotent. For staging, start from a new database, apply
migrations and seed; do not clone this reused local database.

Rollback for a mistaken cleanup is restore from the pre-cleanup backup into a
separate database, compare namespace ownership, and forward-copy only reviewed
rows. Never reset or truncate the source database.
