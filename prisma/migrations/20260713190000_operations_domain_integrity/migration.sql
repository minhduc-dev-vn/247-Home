-- ARRIVED is additive. CONFIRMED remains in the enum for migration compatibility,
-- but existing rows are normalized and application policy no longer emits it.
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'ARRIVED';

UPDATE "installation_appointments"
SET "status" = 'ASSIGNED'
WHERE "status" = 'CONFIRMED';

ALTER TABLE "technician_assignments"
  ADD COLUMN "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "arrived_at" TIMESTAMPTZ;

CREATE TABLE "technician_service_areas" (
  "technician_id" TEXT NOT NULL,
  "service_area_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "technician_service_areas_pkey" PRIMARY KEY ("technician_id", "service_area_id"),
  CONSTRAINT "technician_service_areas_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "technician_service_areas_service_area_id_fkey"
    FOREIGN KEY ("service_area_id") REFERENCES "service_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "technician_service_areas_service_area_id_technician_id_idx"
  ON "technician_service_areas" ("service_area_id", "technician_id");

ALTER TABLE "technician_assignments"
  ADD CONSTRAINT "technician_assignments_timestamp_order"
  CHECK (
    ("accepted_at" IS NULL OR "accepted_at" >= "assigned_at") AND
    ("en_route_at" IS NULL OR "en_route_at" >= COALESCE("accepted_at", "assigned_at")) AND
    ("arrived_at" IS NULL OR ("en_route_at" IS NOT NULL AND "arrived_at" >= "en_route_at")) AND
    ("started_at" IS NULL OR ("arrived_at" IS NOT NULL AND "started_at" >= "arrived_at")) AND
    ("completed_at" IS NULL OR ("started_at" IS NOT NULL AND "completed_at" >= "started_at"))
  );

-- Rollback notes (manual, only when no ARRIVED rows remain): drop the timestamp
-- check, technician_service_areas, assigned_at/arrived_at columns, then rebuild
-- AppointmentStatus without ARRIVED. PostgreSQL enum values are not dropped in place.
