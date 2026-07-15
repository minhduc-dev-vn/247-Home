INSERT INTO "addresses" (
  "id", "user_id", "recipient_name", "phone", "line1", "ward_name",
  "district_code", "district_name", "province_code", "province_name",
  "is_default", "created_at", "updated_at"
) VALUES
  (
    'upgrade-default-address-a', 'upgrade-user-1', 'Upgrade Customer',
    '0900000000', '1 Upgrade Street', 'Upgrade Ward', 'UPGRADE-DISTRICT',
    'Upgrade District', 'UPGRADE-PROVINCE', 'Upgrade Province', true,
    TIMESTAMPTZ '2025-01-01 07:00:00+00',
    TIMESTAMPTZ '2025-01-01 07:00:00+00'
  ),
  (
    'upgrade-default-address-b', 'upgrade-user-1', 'Upgrade Customer',
    '0900000000', '2 Upgrade Street', 'Upgrade Ward', 'UPGRADE-DISTRICT',
    'Upgrade District', 'UPGRADE-PROVINCE', 'Upgrade Province', true,
    TIMESTAMPTZ '2025-01-02 07:00:00+00',
    TIMESTAMPTZ '2025-01-02 07:00:00+00'
  );
