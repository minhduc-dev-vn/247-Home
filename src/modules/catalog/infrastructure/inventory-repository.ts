import { type Prisma } from '@prisma/client';

export async function lockInventory(
  transaction: Prisma.TransactionClient,
  productVariantId: string,
) {
  const rows = await transaction.$queryRaw<
    { onHand: number; reserved: number; version: number }[]
  >`SELECT "on_hand" AS "onHand", "reserved", "version" FROM "inventory" WHERE "product_variant_id" = ${productVariantId} FOR UPDATE`;
  return rows.at(0) ?? null;
}
