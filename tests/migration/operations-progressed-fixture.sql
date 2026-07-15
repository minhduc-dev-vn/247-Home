INSERT INTO "users" (
  "id", "email", "name", "password_hash", "created_at", "updated_at"
)
SELECT
  'upgrade-user-' || n,
  'upgrade-user-' || n || '@example.test',
  'Upgrade User ' || n,
  'test-only-hash',
  TIMESTAMPTZ '2025-01-01 07:00:00+00',
  TIMESTAMPTZ '2025-01-01 13:00:00+00'
FROM generate_series(1, 6) AS n;

INSERT INTO "service_areas" (
  "id", "code", "province_code", "province_name", "district_code",
  "district_name", "created_at", "updated_at"
) VALUES (
  'upgrade-area', 'UPGRADE-AREA', 'UPGRADE-PROVINCE', 'Upgrade Province',
  'UPGRADE-DISTRICT', 'Upgrade District',
  TIMESTAMPTZ '2025-01-01 07:00:00+00',
  TIMESTAMPTZ '2025-01-01 13:00:00+00'
);

INSERT INTO "installation_slots" (
  "id", "service_area_id", "starts_at", "ends_at", "capacity",
  "booked_count", "created_at", "updated_at"
)
SELECT
  'upgrade-slot-' || n,
  'upgrade-area',
  TIMESTAMPTZ '2025-02-01 08:00:00+00' + (n || ' days')::INTERVAL,
  TIMESTAMPTZ '2025-02-01 10:00:00+00' + (n || ' days')::INTERVAL,
  1,
  1,
  TIMESTAMPTZ '2025-01-01 07:00:00+00',
  TIMESTAMPTZ '2025-01-01 13:00:00+00'
FROM generate_series(1, 5) AS n;

INSERT INTO "orders" (
  "id", "order_number", "user_id", "status", "subtotal",
  "installation_fee", "shipping_fee", "grand_total", "recipient_name",
  "recipient_phone", "address_line1", "ward_name", "district_code",
  "district_name", "province_code", "province_name", "country_code",
  "service_area_id", "idempotency_hash", "request_fingerprint",
  "created_at", "updated_at"
)
SELECT
  'upgrade-order-' || n,
  'UPGRADE-ORDER-' || n,
  'upgrade-user-1',
  'READY_FOR_INSTALLATION',
  100000,
  0,
  0,
  100000,
  'Upgrade Customer',
  '0900000000',
  '1 Upgrade Street',
  'Upgrade Ward',
  'UPGRADE-DISTRICT',
  'Upgrade District',
  'UPGRADE-PROVINCE',
  'Upgrade Province',
  'VN',
  'upgrade-area',
  'upgrade-idempotency-' || n,
  'upgrade-fingerprint-' || n,
  TIMESTAMPTZ '2025-01-01 07:00:00+00',
  TIMESTAMPTZ '2025-01-01 13:00:00+00'
FROM generate_series(1, 5) AS n;

INSERT INTO "installation_appointments" (
  "id", "order_id", "service_area_id", "installation_slot_id", "status",
  "scheduled_start_at", "scheduled_end_at", "created_at", "updated_at"
)
SELECT
  'upgrade-appointment-' || n,
  'upgrade-order-' || n,
  'upgrade-area',
  'upgrade-slot-' || n,
  (ARRAY['ASSIGNED', 'EN_ROUTE', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'])[n]::"AppointmentStatus",
  TIMESTAMPTZ '2025-02-01 08:00:00+00' + (n || ' days')::INTERVAL,
  TIMESTAMPTZ '2025-02-01 10:00:00+00' + (n || ' days')::INTERVAL,
  TIMESTAMPTZ '2025-01-01 07:00:00+00',
  TIMESTAMPTZ '2025-01-01 13:00:00+00'
FROM generate_series(1, 5) AS n;

INSERT INTO "technicians" (
  "id", "user_id", "created_at", "updated_at"
)
SELECT
  'upgrade-technician-' || n,
  'upgrade-user-' || (n + 1),
  TIMESTAMPTZ '2025-01-01 07:00:00+00',
  TIMESTAMPTZ '2025-01-01 13:00:00+00'
FROM generate_series(1, 5) AS n;

INSERT INTO "technician_assignments" (
  "id", "installation_appointment_id", "technician_id", "status",
  "accepted_at", "en_route_at", "started_at", "completed_at",
  "scheduled_start_at", "scheduled_end_at", "created_at", "updated_at"
)
SELECT
  'upgrade-assignment-' || n,
  'upgrade-appointment-' || n,
  'upgrade-technician-' || n,
  CASE WHEN n = 5 THEN 'COMPLETED' ELSE 'ACTIVE' END::"AssignmentStatus",
  CASE WHEN n >= 2 THEN TIMESTAMPTZ '2025-01-01 09:00:00+00' END,
  CASE WHEN n >= 2 THEN TIMESTAMPTZ '2025-01-01 10:00:00+00' END,
  CASE WHEN n >= 4 THEN TIMESTAMPTZ '2025-01-01 11:00:00+00' END,
  CASE WHEN n = 5 THEN TIMESTAMPTZ '2025-01-01 12:00:00+00' END,
  TIMESTAMPTZ '2025-02-01 08:00:00+00' + (n || ' days')::INTERVAL,
  TIMESTAMPTZ '2025-02-01 10:00:00+00' + (n || ' days')::INTERVAL,
  TIMESTAMPTZ '2025-01-01 08:00:00+00',
  TIMESTAMPTZ '2025-01-01 13:00:00+00'
FROM generate_series(1, 5) AS n;
