-- Forward-only ownership ledger for inventory reserved by an order item.
-- Historical RESERVED rows are backfilled only when the aggregate can be
-- reconciled exactly with inventory.reserved. Ambiguous rows remain without
-- an allocation and are deliberately blocked by the application transition.
BEGIN;

CREATE TABLE "inventory_allocations" (
  "id" TEXT NOT NULL,
  "order_item_id" TEXT NOT NULL,
  "product_variant_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "InventoryDisposition" NOT NULL DEFAULT 'RESERVED',
  "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  CONSTRAINT "inventory_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_allocations_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "inventory_allocations_lifecycle_check" CHECK (
    ("status" = 'RESERVED' AND "consumed_at" IS NULL AND "released_at" IS NULL)
    OR ("status" = 'CONSUMED' AND "consumed_at" IS NOT NULL AND "released_at" IS NULL)
    OR ("status" = 'RELEASED' AND "consumed_at" IS NULL AND "released_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "inventory_allocations_order_item_id_key"
  ON "inventory_allocations" ("order_item_id");
CREATE INDEX "inventory_allocations_product_variant_id_status_idx"
  ON "inventory_allocations" ("product_variant_id", "status");

ALTER TABLE "inventory_allocations"
  ADD CONSTRAINT "inventory_allocations_order_item_id_fkey"
    FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_allocations_product_variant_id_fkey"
    FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

WITH reserved_totals AS (
  SELECT
    item."product_variant_id",
    SUM(item."quantity")::INTEGER AS expected_reserved
  FROM "order_items" AS item
  INNER JOIN "orders" AS purchase ON purchase."id" = item."order_id"
  WHERE purchase."inventory_status" = 'RESERVED'
  GROUP BY item."product_variant_id"
), reconcilable_variants AS (
  SELECT inventory."product_variant_id"
  FROM "inventory" AS inventory
  LEFT JOIN reserved_totals
    ON reserved_totals."product_variant_id" = inventory."product_variant_id"
  WHERE inventory."reserved" = COALESCE(reserved_totals.expected_reserved, 0)
)
INSERT INTO "inventory_allocations" (
  "id",
  "order_item_id",
  "product_variant_id",
  "quantity",
  "status",
  "reserved_at",
  "consumed_at",
  "released_at"
)
SELECT
  'legacy_' || md5(item."id"),
  item."id",
  item."product_variant_id",
  item."quantity",
  purchase."inventory_status",
  item."created_at",
  CASE
    WHEN purchase."inventory_status" = 'CONSUMED'
      THEN COALESCE(purchase."completed_at", purchase."updated_at")
    ELSE NULL
  END,
  CASE
    WHEN purchase."inventory_status" = 'RELEASED'
      THEN COALESCE(purchase."cancelled_at", purchase."updated_at")
    ELSE NULL
  END
FROM "order_items" AS item
INNER JOIN "orders" AS purchase ON purchase."id" = item."order_id"
LEFT JOIN reconcilable_variants
  ON reconcilable_variants."product_variant_id" = item."product_variant_id"
WHERE purchase."inventory_status" <> 'RESERVED'
   OR reconcilable_variants."product_variant_id" IS NOT NULL;

DO $$
DECLARE
  unresolved_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO unresolved_count
  FROM "order_items" AS item
  INNER JOIN "orders" AS purchase ON purchase."id" = item."order_id"
  LEFT JOIN "inventory_allocations" AS allocation
    ON allocation."order_item_id" = item."id"
  WHERE purchase."inventory_status" = 'RESERVED'
    AND allocation."id" IS NULL;

  IF unresolved_count > 0 THEN
    RAISE WARNING 'INVENTORY_ALLOCATION_RECONCILIATION_REQUIRED: % RESERVED order item(s) were not backfilled', unresolved_count;
  END IF;
END $$;

COMMENT ON TABLE "inventory_allocations" IS
  'Per-order-item inventory ownership ledger. Missing legacy RESERVED rows must be reconciled before transition.';

COMMIT;
