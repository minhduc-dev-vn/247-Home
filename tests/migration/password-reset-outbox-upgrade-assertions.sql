DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'PasswordResetDeliveryStatus'
  ) THEN
    RAISE EXCEPTION 'PASSWORD_RESET_OUTBOX_ENUM_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'password_reset_deliveries_attempts_nonnegative'
  ) THEN
    RAISE EXCEPTION 'PASSWORD_RESET_OUTBOX_ATTEMPT_CHECK_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'password_reset_deliveries_status_next_attempt_created_idx'
  ) THEN
    RAISE EXCEPTION 'PASSWORD_RESET_OUTBOX_WORKER_INDEX_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "password_reset_tokens"
    WHERE "id" = 'legacy-password-reset-token'
      AND "used_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'PASSWORD_RESET_LEGACY_TOKEN_WAS_LOST_OR_MUTATED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "password_reset_deliveries"
    WHERE "password_reset_token_id" = 'legacy-password-reset-token'
  ) THEN
    RAISE EXCEPTION 'PASSWORD_RESET_LEGACY_TOKEN_WAS_SILENTLY_BACKFILLED';
  END IF;
END $$;
