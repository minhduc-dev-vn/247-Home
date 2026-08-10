-- Authorization roles are system reference data, not demo seed data.
-- This forward-only migration is idempotent for databases that were seeded.
INSERT INTO "roles" ("id", "code", "created_at")
VALUES
    ('system_role_customer_v1', 'CUSTOMER', CURRENT_TIMESTAMP),
    ('system_role_staff_v1', 'STAFF', CURRENT_TIMESTAMP),
    ('system_role_technician_v1', 'TECHNICIAN', CURRENT_TIMESTAMP),
    ('system_role_manager_v1', 'MANAGER', CURRENT_TIMESTAMP),
    ('system_role_admin_v1', 'ADMIN', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Do not roll back by deleting role rows: existing user_roles may reference them.
-- Forward-fix any unexpected ID collision after inspecting roles and user_roles.
