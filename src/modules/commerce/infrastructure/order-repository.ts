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
