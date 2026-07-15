import {
  type IdentityActor,
  hasAnyRole,
} from '@/modules/identity/domain/roles';

export function actorHasRole(
  actor: IdentityActor,
  roles: Parameters<typeof hasAnyRole>[1],
): boolean {
  return hasAnyRole(actor, roles);
}
