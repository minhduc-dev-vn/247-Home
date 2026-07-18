export class CatalogError extends Error {
  constructor(
    public readonly code:
      | 'CONFLICT'
      | 'CONCURRENT_MODIFICATION'
      | 'CART_EMPTY'
      | 'FORBIDDEN'
      | 'IDEMPOTENCY_CONFLICT'
      | 'INVENTORY_INSUFFICIENT'
      | 'INVENTORY_CONFLICT'
      | 'INVALID_STATE_TRANSITION'
      | 'NOT_FOUND'
      | 'SERVICE_AREA_UNSUPPORTED'
      | 'SLOT_UNAVAILABLE'
      | 'UNAUTHENTICATED'
      | 'WARRANTY_NOT_ELIGIBLE',
    message: string = code,
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}
