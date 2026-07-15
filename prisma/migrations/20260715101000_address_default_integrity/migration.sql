-- Enforce at most one active default address per customer. Existing ambiguous
-- data is rejected instead of being silently reordered or rewritten.
BEGIN;

LOCK TABLE "addresses" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  duplicate_users BIGINT;
BEGIN
  SELECT COUNT(*) INTO duplicate_users
  FROM (
    SELECT "user_id"
    FROM "addresses"
    WHERE "is_default" = true AND "archived_at" IS NULL
    GROUP BY "user_id"
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_users > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'ADDRESS_DEFAULT_HISTORY_INVALID',
      DETAIL = format('%s user(s) have multiple active default addresses; no data was changed', duplicate_users),
      HINT = 'Resolve the intended default from source history with an audited forward fix, then rerun this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "addresses_one_default_per_user"
  ON "addresses" ("user_id")
  WHERE "is_default" = true AND "archived_at" IS NULL;

COMMIT;
