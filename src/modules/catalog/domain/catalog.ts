export type PublicAvailability = 'IN_STOCK' | 'OUT_OF_STOCK';

export function getAvailability(
  inventory: { onHand: number; reserved: number } | null,
): PublicAvailability {
  return inventory && inventory.onHand > inventory.reserved
    ? 'IN_STOCK'
    : 'OUT_OF_STOCK';
}

export function moneyToString(value: bigint): string {
  return value.toString();
}
