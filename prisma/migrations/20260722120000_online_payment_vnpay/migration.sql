-- Forward-only online payment foundation. Existing COD/BANK_TRANSFER rows keep
-- their current lifecycle and do not receive synthetic provider metadata.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'VNPAY';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

CREATE TYPE "PaymentSessionStatus" AS ENUM (
  'CREATED',
  'PENDING',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

CREATE TYPE "PaymentWebhookOutcome" AS ENUM (
  'PROCESSED',
  'DUPLICATE',
  'REJECTED'
);

ALTER TABLE "payments"
  ADD COLUMN "provider_transaction_id" TEXT,
  ADD COLUMN "provider_response_code" TEXT,
  ADD COLUMN "paid_at" TIMESTAMP(3),
  ADD COLUMN "failed_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "refunded_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "payments_provider_transaction_id_key"
  ON "payments"("provider_transaction_id");

CREATE TABLE "payment_sessions" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "provider" "PaymentMethod" NOT NULL,
  "status" "PaymentSessionStatus" NOT NULL DEFAULT 'CREATED',
  "provider_reference" TEXT NOT NULL,
  "idempotency_hash" TEXT NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_sessions_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payment_sessions_provider_reference_key"
  ON "payment_sessions"("provider_reference");
CREATE UNIQUE INDEX "payment_sessions_payment_id_idempotency_hash_key"
  ON "payment_sessions"("payment_id", "idempotency_hash");
CREATE INDEX "payment_sessions_payment_id_status_created_at_idx"
  ON "payment_sessions"("payment_id", "status", "created_at");
CREATE INDEX "payment_sessions_expires_at_status_idx"
  ON "payment_sessions"("expires_at", "status");

CREATE TABLE "payment_webhook_events" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "payment_session_id" TEXT NOT NULL,
  "provider" "PaymentMethod" NOT NULL,
  "event_key" TEXT NOT NULL,
  "provider_transaction_id" TEXT,
  "amount" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "response_code" TEXT NOT NULL,
  "transaction_status" TEXT NOT NULL,
  "pay_date" TIMESTAMP(3),
  "outcome" "PaymentWebhookOutcome" NOT NULL,
  "request_id" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),

  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_webhook_events_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_webhook_events_payment_session_id_fkey"
    FOREIGN KEY ("payment_session_id") REFERENCES "payment_sessions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payment_webhook_events_event_key_key"
  ON "payment_webhook_events"("event_key");
CREATE INDEX "payment_webhook_events_payment_id_received_at_idx"
  ON "payment_webhook_events"("payment_id", "received_at");
CREATE INDEX "payment_webhook_events_payment_session_id_received_at_idx"
  ON "payment_webhook_events"("payment_session_id", "received_at");
CREATE INDEX "payment_webhook_events_provider_transaction_id_idx"
  ON "payment_webhook_events"("provider_transaction_id");

ALTER TABLE "payment_webhook_events"
  ADD CONSTRAINT "payment_webhook_events_amount_positive_check"
  CHECK ("amount" > 0);
