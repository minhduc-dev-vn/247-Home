import { type Prisma } from '@prisma/client';

export async function lockOrder(
  transaction: Prisma.TransactionClient,
  orderId: string,
): Promise<boolean> {
  const rows = await transaction.$queryRaw<
    { id: string }[]
  >`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
  return rows.length === 1;
}

export async function lockPayment(
  transaction: Prisma.TransactionClient,
  paymentId: string,
): Promise<boolean> {
  const rows = await transaction.$queryRaw<
    { id: string }[]
  >`SELECT "id" FROM "payments" WHERE "id" = ${paymentId} FOR UPDATE`;
  return rows.length === 1;
}

export type LockedOrderAppointment = {
  id: string;
  slotId: string;
  status: string;
  version: number;
  capacityReleasedAt: Date | null;
};

export async function lockOrderAppointment(
  transaction: Prisma.TransactionClient,
  appointmentId: string,
): Promise<LockedOrderAppointment | null> {
  const rows = await transaction.$queryRaw<LockedOrderAppointment[]>`
    SELECT
      "id",
      "installation_slot_id" AS "slotId",
      "status"::text AS "status",
      "version",
      "capacity_released_at" AS "capacityReleasedAt"
    FROM "installation_appointments"
    WHERE "id" = ${appointmentId}
    FOR UPDATE
  `;
  return rows.at(0) ?? null;
}

export type LockedOrderSlot = {
  id: string;
  bookedCount: number;
  version: number;
};

export async function lockOrderSlot(
  transaction: Prisma.TransactionClient,
  slotId: string,
): Promise<LockedOrderSlot | null> {
  const rows = await transaction.$queryRaw<LockedOrderSlot[]>`
    SELECT
      "id",
      "booked_count" AS "bookedCount",
      "version"
    FROM "installation_slots"
    WHERE "id" = ${slotId}
    FOR UPDATE
  `;
  return rows.at(0) ?? null;
}
