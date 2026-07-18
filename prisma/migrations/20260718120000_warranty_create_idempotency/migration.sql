ALTER TABLE "warranty_requests"
  ADD COLUMN "idempotency_hash" TEXT,
  ADD COLUMN "request_fingerprint" TEXT;

ALTER TABLE "warranty_requests"
  ADD CONSTRAINT "warranty_requests_idempotency_pair_check"
  CHECK (
    ("idempotency_hash" IS NULL AND "request_fingerprint" IS NULL)
    OR (
      char_length("idempotency_hash") = 64
      AND char_length("request_fingerprint") = 64
    )
  );

CREATE UNIQUE INDEX "warranty_requests_customer_idempotency_key"
  ON "warranty_requests" ("customer_user_id", "idempotency_hash")
  WHERE "idempotency_hash" IS NOT NULL;

ALTER TABLE "warranty_requests"
  DROP CONSTRAINT "warranty_requests_lifecycle_timestamps_check",
  ADD CONSTRAINT "warranty_requests_lifecycle_timestamps_check"
  CHECK (
    ("status" <> 'RESOLVED' OR "resolved_at" IS NOT NULL)
    AND ("status" <> 'REJECTED' OR "rejected_at" IS NOT NULL)
    AND (
      "status" <> 'CLOSED'
      OR (
        "closed_at" IS NOT NULL
        AND ("resolved_at" IS NOT NULL OR "rejected_at" IS NOT NULL)
      )
    )
  );
