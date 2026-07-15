export const roleCodes = [
  'CUSTOMER',
  'STAFF',
  'TECHNICIAN',
  'MANAGER',
  'ADMIN',
] as const;

export type RoleCode = (typeof roleCodes)[number];

export type IdentityActor = {
  userId: string;
  authVersion: number;
  roles: readonly RoleCode[];
};

export function hasAnyRole(
  actor: IdentityActor,
  requiredRoles: readonly RoleCode[],
): boolean {
  return requiredRoles.some((role) => actor.roles.includes(role));
}

export function canAccessOwnUser(
  actor: IdentityActor,
  userId: string,
): boolean {
  return actor.userId === userId;
}
