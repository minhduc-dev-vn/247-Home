import { type Prisma } from '@prisma/client';

export async function lockWarrantyCreateIdempotency(
  transaction: Prisma.TransactionClient,
  customerUserId: string,
  idempotencyHash: string,
): Promise<void> {
  const lockScope = `${customerUserId}:${idempotencyHash}`;
  await transaction.$queryRaw`
    SELECT true AS "locked"
    FROM pg_advisory_xact_lock(hashtextextended(${lockScope}, 0))
  `;
}
