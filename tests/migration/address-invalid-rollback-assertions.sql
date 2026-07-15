DO $$
DECLARE
  duplicate_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM "addresses"
  WHERE "user_id" = 'upgrade-user-1' AND "is_default" = true;
  IF duplicate_count <> 2 THEN
    RAISE EXCEPTION 'failed address migration changed source history';
  END IF;
  IF to_regclass('public.addresses_one_default_per_user') IS NOT NULL THEN
    RAISE EXCEPTION 'failed address migration left a partial index behind';
  END IF;
END $$;
