import { actorHasRole, type IdentityActor } from '@/modules/identity';
import { CatalogError } from '@/modules/catalog/domain/errors';

const catalogRoles = ['STAFF', 'MANAGER', 'ADMIN'] as const;
const priceRoles = ['MANAGER', 'ADMIN'] as const;

export function requireCatalogAccess(
  actor: IdentityActor | null,
): IdentityActor {
  if (!actor) {
    throw new CatalogError('UNAUTHENTICATED');
  }
  if (!actorHasRole(actor, catalogRoles)) {
    throw new CatalogError('FORBIDDEN');
  }
  return actor;
}

export function requirePriceAccess(actor: IdentityActor | null): IdentityActor {
  const catalogActor = requireCatalogAccess(actor);
  if (!actorHasRole(catalogActor, priceRoles)) {
    throw new CatalogError('FORBIDDEN');
  }
  return catalogActor;
}
