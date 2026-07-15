-- ARRIVED cannot exist in the pre-integrity enum. Exercise it immediately
-- after the migration while preserving the other four appointment states.
UPDATE "technician_assignments"
SET "arrived_at" = TIMESTAMPTZ '2025-01-01 10:30:00+00'
WHERE "id" = 'upgrade-assignment-3';

UPDATE "installation_appointments"
SET "status" = 'ARRIVED'
WHERE "id" = 'upgrade-appointment-3';

DO $$
DECLARE
  constraint_validated BOOLEAN;
BEGIN
  IF (SELECT COUNT(*) FROM "technician_assignments" WHERE "id" LIKE 'upgrade-assignment-%') <> 5 THEN
    RAISE EXCEPTION 'UPGRADE_DATA_LOSS: expected five assignments';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "technician_assignments"
    WHERE "id" LIKE 'upgrade-assignment-%'
      AND (
        ("accepted_at" IS NOT NULL AND "assigned_at" > "accepted_at")
        OR ("en_route_at" IS NOT NULL AND "assigned_at" > "en_route_at")
        OR ("arrived_at" IS NOT NULL AND "assigned_at" > "arrived_at")
        OR ("started_at" IS NOT NULL AND "assigned_at" > "started_at")
        OR ("completed_at" IS NOT NULL AND "assigned_at" > "completed_at")
      )
  ) THEN
    RAISE EXCEPTION 'UPGRADE_ASSIGNED_AT_ORDER_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "technician_assignments"
    WHERE "id" IN ('upgrade-assignment-4', 'upgrade-assignment-5')
      AND "arrived_at" IS DISTINCT FROM "started_at"
  ) THEN
    RAISE EXCEPTION 'UPGRADE_LEGACY_ARRIVED_BACKFILL_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "technician_assignments"
    WHERE "id" LIKE 'upgrade-assignment-%'
      AND (
        "accepted_at" IS DISTINCT FROM CASE WHEN "id" = 'upgrade-assignment-1' THEN NULL ELSE TIMESTAMPTZ '2025-01-01 09:00:00+00' END
        OR "en_route_at" IS DISTINCT FROM CASE WHEN "id" = 'upgrade-assignment-1' THEN NULL ELSE TIMESTAMPTZ '2025-01-01 10:00:00+00' END
        OR "started_at" IS DISTINCT FROM CASE WHEN "id" IN ('upgrade-assignment-4', 'upgrade-assignment-5') THEN TIMESTAMPTZ '2025-01-01 11:00:00+00' ELSE NULL END
        OR "completed_at" IS DISTINCT FROM CASE WHEN "id" = 'upgrade-assignment-5' THEN TIMESTAMPTZ '2025-01-01 12:00:00+00' ELSE NULL END
      )
  ) THEN
    RAISE EXCEPTION 'UPGRADE_KNOWN_HISTORY_CHANGED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "installation_appointments"
    WHERE "id" LIKE 'upgrade-appointment-%'
      AND "status" <> (CASE "id"
        WHEN 'upgrade-appointment-1' THEN 'ASSIGNED'
        WHEN 'upgrade-appointment-2' THEN 'EN_ROUTE'
        WHEN 'upgrade-appointment-3' THEN 'ARRIVED'
        WHEN 'upgrade-appointment-4' THEN 'IN_PROGRESS'
        WHEN 'upgrade-appointment-5' THEN 'COMPLETED'
      END)::"AppointmentStatus"
  ) THEN
    RAISE EXCEPTION 'UPGRADE_APPOINTMENT_STATE_CHANGED';
  END IF;

  SELECT "convalidated"
  INTO constraint_validated
  FROM "pg_constraint"
  WHERE "conname" = 'technician_assignments_timestamp_order'
    AND "conrelid" = 'technician_assignments'::REGCLASS;

  IF constraint_validated IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'UPGRADE_CONSTRAINT_NOT_VALIDATED';
  END IF;
END $$;

-- Prove the validated constraint actively rejects a new ordering violation.
DO $$
BEGIN
  BEGIN
    UPDATE "technician_assignments"
    SET "arrived_at" = "en_route_at" - INTERVAL '1 minute'
    WHERE "id" = 'upgrade-assignment-4';
    RAISE EXCEPTION 'UPGRADE_CONSTRAINT_DID_NOT_REJECT_INVALID_WRITE';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END $$;
