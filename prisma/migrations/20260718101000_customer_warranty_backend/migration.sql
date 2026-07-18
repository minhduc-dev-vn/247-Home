CREATE TYPE "WarrantyCoverageType" AS ENUM ('DEVICE', 'INSTALLATION');

ALTER TABLE "product_variants"
  ADD COLUMN "warranty_months" INTEGER NOT NULL DEFAULT 12;

ALTER TABLE "order_items"
  ADD COLUMN "warranty_months" INTEGER NOT NULL DEFAULT 12;

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_warranty_months_check"
  CHECK ("warranty_months" >= 0 AND "warranty_months" <= 120);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_warranty_months_check"
  CHECK ("warranty_months" >= 0 AND "warranty_months" <= 120);

ALTER TABLE "warranty_requests"
  ADD COLUMN "coverage_type" "WarrantyCoverageType",
  ADD COLUMN "contact_phone" TEXT,
  ADD COLUMN "public_resolution" TEXT,
  ADD COLUMN "internal_note" TEXT,
  ADD COLUMN "warranty_starts_at" TIMESTAMPTZ,
  ADD COLUMN "warranty_expires_at" TIMESTAMPTZ,
  ADD COLUMN "resolved_at" TIMESTAMPTZ,
  ADD COLUMN "closed_at" TIMESTAMPTZ,
  ADD COLUMN "rejected_at" TIMESTAMPTZ,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Existing Operations rows predate the customer API. DEVICE is the only safe
-- coverage inference; order completion is preferred and order creation is the
-- documented fallback for legacy rows that lack completed_at.
UPDATE "warranty_requests" AS wr
SET
  "coverage_type" = 'DEVICE',
  "contact_phone" = o."recipient_phone",
  "warranty_starts_at" = COALESCE(o."completed_at", o."created_at", wr."submitted_at"),
  "warranty_expires_at" = COALESCE(o."completed_at", o."created_at", wr."submitted_at")
    + make_interval(months => oi."warranty_months"),
  "resolved_at" = CASE
    WHEN wr."status" IN ('RESOLVED', 'CLOSED') THEN wr."updated_at"
    ELSE NULL
  END,
  "closed_at" = CASE
    WHEN wr."status" = 'CLOSED' THEN wr."updated_at"
    ELSE NULL
  END
FROM "order_items" AS oi
JOIN "orders" AS o ON o."id" = oi."order_id"
WHERE oi."id" = wr."order_item_id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "warranty_requests"
    WHERE "coverage_type" IS NULL
       OR "contact_phone" IS NULL
       OR "warranty_starts_at" IS NULL
       OR "warranty_expires_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'Customer warranty backfill failed: an existing request has no resolvable order snapshot';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "warranty_requests"
    GROUP BY "customer_user_id", "order_item_id", "coverage_type"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Customer warranty migration blocked: duplicate request coverage exists';
  END IF;
END $$;

ALTER TABLE "warranty_requests"
  ALTER COLUMN "coverage_type" SET NOT NULL,
  ALTER COLUMN "contact_phone" SET NOT NULL,
  ALTER COLUMN "warranty_starts_at" SET NOT NULL,
  ALTER COLUMN "warranty_expires_at" SET NOT NULL;

ALTER TABLE "warranty_requests"
  ADD CONSTRAINT "warranty_requests_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "warranty_requests_contact_phone_check"
    CHECK (char_length("contact_phone") BETWEEN 8 AND 20),
  ADD CONSTRAINT "warranty_requests_description_check"
    CHECK (char_length("description") BETWEEN 20 AND 2000),
  ADD CONSTRAINT "warranty_requests_expiry_check"
    CHECK ("warranty_expires_at" >= "warranty_starts_at"),
  ADD CONSTRAINT "warranty_requests_lifecycle_timestamps_check"
    CHECK (
      ("status" NOT IN ('RESOLVED', 'CLOSED') OR "resolved_at" IS NOT NULL)
      AND ("status" <> 'CLOSED' OR "closed_at" IS NOT NULL)
      AND ("status" <> 'REJECTED' OR "rejected_at" IS NOT NULL)
    );

CREATE UNIQUE INDEX "warranty_requests_customer_item_coverage_key"
  ON "warranty_requests" ("customer_user_id", "order_item_id", "coverage_type");
CREATE INDEX "warranty_requests_customer_user_id_created_at_idx"
  ON "warranty_requests" ("customer_user_id", "created_at");

CREATE TABLE "warranty_evidence" (
  "id" TEXT NOT NULL,
  "warranty_request_id" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warranty_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "warranty_evidence_storage_key_key" UNIQUE ("storage_key"),
  CONSTRAINT "warranty_evidence_size_check"
    CHECK ("byte_size" > 0 AND "byte_size" <= 5242880),
  CONSTRAINT "warranty_evidence_request_fkey"
    FOREIGN KEY ("warranty_request_id") REFERENCES "warranty_requests"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "warranty_evidence_request_created_at_idx"
  ON "warranty_evidence" ("warranty_request_id", "created_at");
