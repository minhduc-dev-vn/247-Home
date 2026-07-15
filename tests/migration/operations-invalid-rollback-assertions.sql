DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'technician_assignments'
      AND column_name IN ('assigned_at', 'arrived_at')
  ) THEN
    RAISE EXCEPTION 'INVALID_UPGRADE_DID_NOT_ROLL_BACK_SCHEMA';
  END IF;

  IF (SELECT COUNT(*) FROM "technician_assignments" WHERE "id" LIKE 'upgrade-assignment-%') <> 5 THEN
    RAISE EXCEPTION 'INVALID_UPGRADE_LOST_DATA';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "technician_assignments"
    WHERE "id" = 'upgrade-assignment-4'
      AND "en_route_at" = TIMESTAMPTZ '2025-01-01 11:30:00+00'
      AND "started_at" = TIMESTAMPTZ '2025-01-01 11:00:00+00'
  ) THEN
    RAISE EXCEPTION 'INVALID_UPGRADE_SILENTLY_CHANGED_HISTORY';
  END IF;
END $$;
