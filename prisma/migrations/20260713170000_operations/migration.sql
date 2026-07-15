CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "WarrantyStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

CREATE TABLE "technicians" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "technicians_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "technicians_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "technicians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "technician_assignments" (
  "id" TEXT NOT NULL,
  "installation_appointment_id" TEXT NOT NULL,
  "technician_id" TEXT NOT NULL,
  "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "completion_note" TEXT,
  "accepted_at" TIMESTAMPTZ,
  "en_route_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "technician_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "technician_assignments_appointment_fkey" FOREIGN KEY ("installation_appointment_id") REFERENCES "installation_appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "technician_assignments_technician_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "technician_assignments_one_active_per_appointment" ON "technician_assignments" ("installation_appointment_id") WHERE "status" = 'ACTIVE';
CREATE INDEX "technician_assignments_technician_id_status_idx" ON "technician_assignments" ("technician_id", "status");
CREATE INDEX "technician_assignments_appointment_id_status_idx" ON "technician_assignments" ("installation_appointment_id", "status");

CREATE TABLE "installation_evidence" (
  "id" TEXT NOT NULL,
  "assignment_id" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "installation_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "installation_evidence_storage_key_key" UNIQUE ("storage_key"),
  CONSTRAINT "installation_evidence_assignment_fkey" FOREIGN KEY ("assignment_id") REFERENCES "technician_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "installation_evidence_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 5242880)
);
CREATE INDEX "installation_evidence_assignment_id_idx" ON "installation_evidence" ("assignment_id");

CREATE TABLE "warranty_requests" (
  "id" TEXT NOT NULL,
  "request_number" TEXT NOT NULL,
  "order_item_id" TEXT NOT NULL,
  "customer_user_id" TEXT NOT NULL,
  "status" "WarrantyStatus" NOT NULL DEFAULT 'SUBMITTED',
  "issue_type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "assigned_staff_user_id" TEXT,
  "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warranty_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "warranty_requests_request_number_key" UNIQUE ("request_number"),
  CONSTRAINT "warranty_requests_order_item_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "warranty_requests_customer_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "warranty_requests_staff_fkey" FOREIGN KEY ("assigned_staff_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "warranty_requests_status_created_at_idx" ON "warranty_requests" ("status", "created_at");
