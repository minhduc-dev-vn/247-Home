import { type Prisma } from '@prisma/client';

export type LockedOperationsSlot = {
  id: string;
  serviceAreaId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  bookedCount: number;
  isActive: boolean;
};

export async function lockInstallationAppointment(
  transaction: Prisma.TransactionClient,
  appointmentId: string,
): Promise<boolean> {
  const rows = await transaction.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "installation_appointments"
    WHERE "id" = ${appointmentId}
    FOR UPDATE
  `;
  return rows.length === 1;
}

export async function lockOperationsSlot(
  transaction: Prisma.TransactionClient,
  slotId: string,
): Promise<LockedOperationsSlot | null> {
  const rows = await transaction.$queryRaw<LockedOperationsSlot[]>`
    SELECT
      "id",
      "service_area_id" AS "serviceAreaId",
      "starts_at" AS "startsAt",
      "ends_at" AS "endsAt",
      "capacity",
      "booked_count" AS "bookedCount",
      "is_active" AS "isActive"
    FROM "installation_slots"
    WHERE "id" = ${slotId}
    FOR UPDATE
  `;
  return rows.at(0) ?? null;
}

export async function lockAppointmentForAssignment(
  transaction: Prisma.TransactionClient,
  assignmentId: string,
): Promise<boolean> {
  const rows = await transaction.$queryRaw<{ id: string }[]>`
    SELECT appointment."id"
    FROM "installation_appointments" AS appointment
    INNER JOIN "technician_assignments" AS assignment
      ON assignment."installation_appointment_id" = appointment."id"
    WHERE assignment."id" = ${assignmentId}
    FOR UPDATE OF appointment
  `;
  return rows.length === 1;
}
