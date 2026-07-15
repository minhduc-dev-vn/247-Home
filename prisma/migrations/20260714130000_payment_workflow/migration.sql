-- Forward-only Operations payment workflow extension. Existing payments remain valid.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "confirmation_reference" TEXT;
