-- Password reset delivery is durable and separate from the HTTP request.
-- Existing tokens are intentionally left untouched. They have no delivery row
-- and the application now fails closed until a reset request is re-issued.
CREATE TYPE "PasswordResetDeliveryStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'DELIVERED',
    'FAILED',
    'CANCELLED'
);

CREATE TABLE "password_reset_deliveries" (
    "id" TEXT NOT NULL,
    "password_reset_token_id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "encrypted_token" TEXT NOT NULL,
    "status" "PasswordResetDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processing_token" TEXT,
    "processing_lease_expires_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "last_failure_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_reset_deliveries_attempts_nonnegative" CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "password_reset_deliveries_password_reset_token_id_key"
  ON "password_reset_deliveries"("password_reset_token_id");

CREATE INDEX "password_reset_deliveries_status_next_attempt_created_idx"
  ON "password_reset_deliveries"("status", "next_attempt_at", "created_at");

ALTER TABLE "password_reset_deliveries"
  ADD CONSTRAINT "password_reset_deliveries_password_reset_token_id_fkey"
  FOREIGN KEY ("password_reset_token_id") REFERENCES "password_reset_tokens"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Forward-fix / rollback note:
-- Do not drop this table or enum on a shared database. Roll back application
-- code only while retaining outbox rows, then issue a forward migration if a
-- schema correction is required. Verify pending/processing rows after deploy.
