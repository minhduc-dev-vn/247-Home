import { type IdentityActor } from '@/modules/identity';

export type InstallationStatus =
  | 'SCHEDULED'
  | 'ASSIGNMENT_PENDING'
  | 'ASSIGNED'
  | 'CONFIRMED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'RESCHEDULE_REQUIRED'
  | 'CANCELLED';

export class OperationsPolicyError extends Error {
  constructor(
    public readonly code:
      'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID_STATE_TRANSITION',
  ) {
    super(code);
    this.name = 'OperationsPolicyError';
  }
}

export type InstallationAction =
  | 'assign'
  | 'accept'
  | 'en-route'
  | 'arrive'
  | 'start'
  | 'complete'
  | 'reschedule'
  | 'cancel';

type TransitionContext = {
  actor: IdentityActor | null;
  action: InstallationAction;
  current: InstallationStatus;
  ownsActiveAssignment?: boolean;
  alreadyAccepted?: boolean;
};

export type TransitionDecision = {
  next: InstallationStatus;
  idempotent: boolean;
};

const managerActions: Partial<
  Record<InstallationAction, readonly InstallationStatus[]>
> = {
  assign: ['ASSIGNMENT_PENDING'],
  reschedule: [
    'SCHEDULED',
    'ASSIGNMENT_PENDING',
    'ASSIGNED',
    'RESCHEDULE_REQUIRED',
  ],
  cancel: ['ASSIGNMENT_PENDING', 'ASSIGNED'],
};

const technicianTransitions: Partial<
  Record<InstallationAction, readonly [InstallationStatus, InstallationStatus]>
> = {
  accept: ['ASSIGNED', 'ASSIGNED'],
  'en-route': ['ASSIGNED', 'EN_ROUTE'],
  arrive: ['EN_ROUTE', 'ARRIVED'],
  start: ['ARRIVED', 'IN_PROGRESS'],
  complete: ['IN_PROGRESS', 'COMPLETED'],
};

function hasRole(actor: IdentityActor, roles: readonly string[]): boolean {
  return roles.some((role) =>
    actor.roles.some((actorRole) => actorRole === role),
  );
}

export function authorizeInstallationTransition({
  actor,
  action,
  current,
  ownsActiveAssignment = false,
  alreadyAccepted = false,
}: TransitionContext): TransitionDecision {
  if (!actor) throw new OperationsPolicyError('UNAUTHENTICATED');

  const managementStates = managerActions[action];
  if (managementStates) {
    if (!hasRole(actor, ['MANAGER', 'ADMIN']))
      throw new OperationsPolicyError('FORBIDDEN');
    if (!managementStates.includes(current))
      throw new OperationsPolicyError('INVALID_STATE_TRANSITION');
    const next =
      action === 'assign'
        ? 'ASSIGNED'
        : action === 'cancel'
          ? 'CANCELLED'
          : 'ASSIGNMENT_PENDING';
    return { next, idempotent: false };
  }

  const transition = technicianTransitions[action];
  if (!transition) throw new OperationsPolicyError('FORBIDDEN');
  if (!hasRole(actor, ['TECHNICIAN']) || !ownsActiveAssignment)
    throw new OperationsPolicyError('FORBIDDEN');
  const [from, next] = transition;
  if (current !== from)
    throw new OperationsPolicyError('INVALID_STATE_TRANSITION');
  return {
    next,
    idempotent: action === 'accept' && alreadyAccepted,
  };
}
