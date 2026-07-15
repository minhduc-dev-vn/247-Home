import { type IdentityActor } from '@/modules/identity';

export const paymentActions = ['CONFIRM_PAYMENT', 'REJECT_PAYMENT'] as const;

export type PaymentAction = (typeof paymentActions)[number];
export type PaymentLifecycleState =
  'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

const paymentOperationsRoles = ['STAFF', 'MANAGER', 'ADMIN'] as const;

const transitions: Record<
  PaymentAction,
  { current: PaymentLifecycleState; next: PaymentLifecycleState }
> = {
  CONFIRM_PAYMENT: { current: 'PENDING', next: 'PAID' },
  REJECT_PAYMENT: { current: 'PENDING', next: 'FAILED' },
};

export type PaymentTransitionDecision =
  | {
      allowed: true;
      current: PaymentLifecycleState;
      next: PaymentLifecycleState;
    }
  | {
      allowed: false;
      code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID_STATE_TRANSITION';
    };

export function decidePaymentTransition(input: {
  actor: IdentityActor | null;
  action: PaymentAction;
  current: PaymentLifecycleState;
}): PaymentTransitionDecision {
  if (!input.actor) return { allowed: false, code: 'UNAUTHENTICATED' };
  if (
    !input.actor.roles.some((role) =>
      paymentOperationsRoles.includes(
        role as (typeof paymentOperationsRoles)[number],
      ),
    )
  )
    return { allowed: false, code: 'FORBIDDEN' };

  const transition = transitions[input.action];
  if (input.current !== transition.current)
    return { allowed: false, code: 'INVALID_STATE_TRANSITION' };

  return { allowed: true, ...transition };
}

export const paymentActionLabels: Record<PaymentAction, string> = {
  CONFIRM_PAYMENT: 'Xac nhan thanh toan',
  REJECT_PAYMENT: 'Tu choi thanh toan',
};
