CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "technician_assignments" ADD COLUMN "scheduled_start_at" TIMESTAMPTZ;
ALTER TABLE "technician_assignments" ADD COLUMN "scheduled_end_at" TIMESTAMPTZ;
UPDATE "technician_assignments" a SET "scheduled_start_at" = i."scheduled_start_at", "scheduled_end_at" = i."scheduled_end_at" FROM "installation_appointments" i WHERE i."id" = a."installation_appointment_id";
ALTER TABLE "technician_assignments" ALTER COLUMN "scheduled_start_at" SET NOT NULL;
ALTER TABLE "technician_assignments" ALTER COLUMN "scheduled_end_at" SET NOT NULL;
ALTER TABLE "technician_assignments" ADD CONSTRAINT "technician_assignments_nonempty_schedule" CHECK ("scheduled_end_at" > "scheduled_start_at");
ALTER TABLE "technician_assignments" ADD CONSTRAINT "technician_assignments_no_active_overlap" EXCLUDE USING gist ("technician_id" WITH =, tstzrange("scheduled_start_at", "scheduled_end_at", '[)') WITH &&) WHERE ("status" = 'ACTIVE');
