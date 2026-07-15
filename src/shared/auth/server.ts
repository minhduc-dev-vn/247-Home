import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';

import {
  actorHasRole,
  getActiveActor,
  type IdentityActor,
  type RoleCode,
} from '@/modules/identity';
import { authOptions } from '@/modules/identity/infrastructure/auth-options';

export async function getCurrentActor(): Promise<IdentityActor | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const authVersion = session?.user?.authVersion;

  return userId && typeof authVersion === 'number'
    ? getActiveActor(userId, authVersion)
    : null;
}

export async function requirePageActor(): Promise<IdentityActor> {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect('/login');
  }
  return actor;
}

export async function requirePageRole(
  ...roles: RoleCode[]
): Promise<IdentityActor> {
  const actor = await requirePageActor();
  if (!actorHasRole(actor, roles)) {
    notFound();
  }
  return actor;
}
