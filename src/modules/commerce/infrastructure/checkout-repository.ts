import { type Prisma } from '@prisma/client';

export type LockedCheckoutSlot = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  bookedCount: number;
};

export async function lockDefaultAddressScope(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT true AS "locked"
    FROM pg_advisory_xact_lock(hashtextextended(${userId}, 0))
  `;
}

export async function claimCheckoutAttempt(
  transaction: Prisma.TransactionClient,
  input: {
    id: string;
    userId: string;
    idempotencyHash: string;
    requestFingerprint: string;
  },
): Promise<string | null> {
  const rows = await transaction.$queryRaw<{ id: string }[]>`
    INSERT INTO "checkout_attempts" (
      "id",
      "user_id",
      "idempotency_hash",
      "request_fingerprint",
      "created_at",
      "updated_at"
    )
    VALUES (
      ${input.id},
      ${input.userId},
      ${input.idempotencyHash},
      ${input.requestFingerprint},
      NOW(),
      NOW()
    )
    ON CONFLICT ("user_id", "idempotency_hash") DO NOTHING
    RETURNING "id"
  `;
  return rows.at(0)?.id ?? null;
}

export async function lockActiveCart(
  transaction: Prisma.TransactionClient,
  cartId: string,
  userId: string,
): Promise<boolean> {
  const rows = await transaction.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "carts"
    WHERE "id" = ${cartId}
      AND "user_id" = ${userId}
      AND "status" = 'ACTIVE'
    FOR UPDATE
  `;
  return rows.length === 1;
}

export async function lockCheckoutSlot(
  transaction: Prisma.TransactionClient,
  slotId: string,
): Promise<LockedCheckoutSlot | null> {
  const rows = await transaction.$queryRaw<LockedCheckoutSlot[]>`
    SELECT
      "id",
      "starts_at" AS "startsAt",
      "ends_at" AS "endsAt",
      "capacity",
      "booked_count" AS "bookedCount"
    FROM "installation_slots"
    WHERE "id" = ${slotId}
    FOR UPDATE
  `;
  return rows.at(0) ?? null;
}
