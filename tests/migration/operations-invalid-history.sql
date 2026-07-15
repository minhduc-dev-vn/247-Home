UPDATE "technician_assignments"
SET
  "en_route_at" = TIMESTAMPTZ '2025-01-01 11:30:00+00',
  "started_at" = TIMESTAMPTZ '2025-01-01 11:00:00+00'
WHERE "id" = 'upgrade-assignment-4';
