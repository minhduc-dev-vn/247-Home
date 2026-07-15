-- H-03 forward fix. The unsafe 20260713190000 migration has already been
-- applied in at least one environment, so its history/checksum is preserved.
--
-- This migration is deliberately idempotent at the schema boundary so the
-- same SQL can be used as the documented recovery patch on a database still
-- at 20260713173000 before reconciling Prisma migration history.
BEGIN;

ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'ARRIVED';

UPDATE "installation_appointments"
SET "status" = 'ASSIGNED'
WHERE "status" = 'CONFIRMED';

ALTER TABLE "technician_assignments"
  ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "arrived_at" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "technician_service_areas" (
  "technician_id" TEXT NOT NULL,
  "service_area_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "technician_service_areas_pkey" PRIMARY KEY ("technician_id", "service_area_id"),
  CONSTRAINT "technician_service_areas_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "technician_service_areas_service_area_id_fkey"
    FOREIGN KEY ("service_area_id") REFERENCES "service_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "technician_service_areas_service_area_id_technician_id_idx"
  ON "technician_service_areas" ("service_area_id", "technician_id");

LOCK TABLE "technician_assignments" IN SHARE ROW EXCLUSIVE MODE;

-- Reject contradictions that cannot be repaired without inventing or
-- reordering known history. Missing arrived_at is the one safe legacy case:
-- before ARRIVED existed, started_at represented the arrival/start boundary.
DO $$
DECLARE
  invalid_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO invalid_count
  FROM "technician_assignments"
  WHERE
    ("accepted_at" IS NOT NULL AND "en_route_at" IS NOT NULL AND "accepted_at" > "en_route_at")
    OR ("en_route_at" IS NOT NULL AND "arrived_at" IS NOT NULL AND "en_route_at" > "arrived_at")
    OR ("arrived_at" IS NOT NULL AND "en_route_at" IS NULL)
    OR ("started_at" IS NOT NULL AND "en_route_at" IS NULL)
    OR ("arrived_at" IS NOT NULL AND "started_at" IS NOT NULL AND "arrived_at" > "started_at")
    OR ("arrived_at" IS NULL AND "en_route_at" IS NOT NULL AND "started_at" IS NOT NULL AND "en_route_at" > "started_at")
    OR ("completed_at" IS NOT NULL AND "started_at" IS NULL)
    OR ("started_at" IS NOT NULL AND "completed_at" IS NOT NULL AND "started_at" > "completed_at");

  IF invalid_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'OPERATIONS_TIMESTAMP_HISTORY_INVALID',
      DETAIL = format('%s technician assignment row(s) have contradictory timestamp history; no data was changed', invalid_count),
      HINT = 'Inspect and correct source history with an audited forward fix before rerunning this migration.';
  END IF;
END $$;

-- Preserve every known timestamp. assigned_at is the earliest trustworthy
-- lifecycle timestamp, including creation/update as a fallback for ASSIGNED.
UPDATE "technician_assignments"
SET "assigned_at" = LEAST(
  COALESCE("assigned_at", 'infinity'::TIMESTAMPTZ),
  COALESCE("accepted_at", 'infinity'::TIMESTAMPTZ),
  COALESCE("en_route_at", 'infinity'::TIMESTAMPTZ),
  COALESCE("arrived_at", 'infinity'::TIMESTAMPTZ),
  COALESCE("started_at", 'infinity'::TIMESTAMPTZ),
  COALESCE("completed_at", 'infinity'::TIMESTAMPTZ),
  "created_at",
  "updated_at"
);

-- Legacy IN_PROGRESS/COMPLETED rows predate ARRIVED. Using started_at for the
-- new boundary preserves all known ordering without inventing elapsed time.
UPDATE "technician_assignments"
SET "arrived_at" = "started_at"
WHERE "arrived_at" IS NULL
  AND "started_at" IS NOT NULL;

ALTER TABLE "technician_assignments"
  ALTER COLUMN "assigned_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "assigned_at" SET NOT NULL;

ALTER TABLE "technician_assignments"
  DROP CONSTRAINT IF EXISTS "technician_assignments_timestamp_order";

ALTER TABLE "technician_assignments"
  ADD CONSTRAINT "technician_assignments_timestamp_order"
  CHECK (
    ("accepted_at" IS NULL OR "accepted_at" >= "assigned_at") AND
    ("en_route_at" IS NULL OR "en_route_at" >= COALESCE("accepted_at", "assigned_at")) AND
    ("arrived_at" IS NULL OR ("en_route_at" IS NOT NULL AND "arrived_at" >= "en_route_at")) AND
    ("started_at" IS NULL OR ("arrived_at" IS NOT NULL AND "started_at" >= "arrived_at")) AND
    ("completed_at" IS NULL OR ("started_at" IS NOT NULL AND "completed_at" >= "started_at"))
  ) NOT VALID;

ALTER TABLE "technician_assignments"
  VALIDATE CONSTRAINT "technician_assignments_timestamp_order";

COMMENT ON COLUMN "technician_assignments"."assigned_at" IS
  'Earliest trustworthy assignment lifecycle timestamp; backfilled by 20260714110000.';
COMMENT ON CONSTRAINT "technician_assignments_timestamp_order" ON "technician_assignments" IS
  'Validated lifecycle ordering. Legacy arrived_at equals started_at when ARRIVED did not yet exist.';

COMMIT;

-- Forward-only operations note:
-- * Never roll back by deleting assignments, timestamps, enum values, or data.
-- * If validation fails, the transaction rolls back. Correct contradictory
--   source history through an audited forward fix, then rerun migrate deploy.
-- * If 20260713190000 already failed, apply this SQL as the recovery patch,
--   verify the checks below, then reconcile both migrations with
--   `prisma migrate resolve --applied` according to the reviewed runbook.
-- * Verify convalidated=true, no ordering violations, unchanged row counts,
--   and unchanged known accepted/en-route/started/completed timestamps.
