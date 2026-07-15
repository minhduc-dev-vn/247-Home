import { type IdentityActor } from '@/modules/identity';

export const orderActions = [
  'confirm',
  'start-processing',
  'mark-ready-for-installation',
  'complete-without-installation',
] as const;

export type OrderAction = (typeof orderActions)[number];
export type OrderState =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY_FOR_INSTALLATION'
  | 'INSTALLATION_IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';
export type InventoryState = 'RESERVED' | 'CONSUMED' | 'RELEASED';
export type PaymentMethodState = 'COD' | 'BANK_TRANSFER';
export type PaymentState =
  'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

export const orderActionLabels: Record<OrderAction, string> = {
  confirm: 'Xac nhan don',
  'start-processing': 'Bat dau xu ly',
  'mark-ready-for-installation': 'San sang lap dat',
  'complete-without-installation': 'Hoan thanh khong lap dat',
};

const orderOperationsRoles: readonly string[] = ['STAFF', 'MANAGER', 'ADMIN'];

type InventoryEffect = 'NONE' | 'CONSUME_RESERVED';
type Policy = {
  current: OrderState;
  next: OrderState;
  expectedInventory: InventoryState;
  inventoryEffect: InventoryEffect;
  requiresNoAppointment?: boolean;
  requiresPaidPayment?: boolean;
};

const policies: Record<OrderAction, Policy> = {
  confirm: {
    current: 'PENDING_CONFIRMATION',
    next: 'CONFIRMED',
    expectedInventory: 'RESERVED',
    inventoryEffect: 'NONE',
  },
  'start-processing': {
    current: 'CONFIRMED',
    next: 'PROCESSING',
    expectedInventory: 'RESERVED',
    inventoryEffect: 'NONE',
  },
  'mark-ready-for-installation': {
    current: 'PROCESSING',
    next: 'READY_FOR_INSTALLATION',
    expectedInventory: 'RESERVED',
    inventoryEffect: 'CONSUME_RESERVED',
  },
  'complete-without-installation': {
    current: 'READY_FOR_INSTALLATION',
    next: 'COMPLETED',
    expectedInventory: 'CONSUMED',
    inventoryEffect: 'NONE',
    requiresNoAppointment: true,
    requiresPaidPayment: true,
  },
};

export type OrderActorDecision =
  | { allowed: true; actor: IdentityActor }
  | { allowed: false; code: 'UNAUTHENTICATED' | 'FORBIDDEN' };

export function authorizeOrderActor(
  actor: IdentityActor | null,
): OrderActorDecision {
  if (!actor) return { allowed: false, code: 'UNAUTHENTICATED' };
  if (!actor.roles.some((role) => orderOperationsRoles.includes(role)))
    return { allowed: false, code: 'FORBIDDEN' };
  return { allowed: true, actor };
}

export type OrderTransitionDecision =
  | {
      allowed: true;
      current: OrderState;
      next: OrderState;
      inventoryEffect: InventoryEffect;
    }
  | {
      allowed: false;
      code:
        | 'UNAUTHENTICATED'
        | 'FORBIDDEN'
        | 'INVALID_STATE_TRANSITION'
        | 'PAYMENT_NOT_READY'
        | 'INVENTORY_NOT_RESERVED';
    };

export function decideOrderTransition(input: {
  actor: IdentityActor | null;
  action: OrderAction;
  current: OrderState;
  inventoryStatus: InventoryState;
  hasAppointment: boolean;
  paymentMethod: PaymentMethodState | null;
  paymentStatus: PaymentState | null;
}): OrderTransitionDecision {
  const actorDecision = authorizeOrderActor(input.actor);
  if (!actorDecision.allowed) return actorDecision;

  const policy = policies[input.action];
  if (input.current !== policy.current)
    return { allowed: false, code: 'INVALID_STATE_TRANSITION' };
  if (policy.requiresNoAppointment && input.hasAppointment)
    return { allowed: false, code: 'INVALID_STATE_TRANSITION' };
  if (input.inventoryStatus !== policy.expectedInventory)
    return { allowed: false, code: 'INVENTORY_NOT_RESERVED' };

  if (input.action === 'confirm') {
    const validCod =
      input.paymentMethod === 'COD' &&
      (input.paymentStatus === 'PENDING' || input.paymentStatus === 'PAID');
    const validTransfer =
      input.paymentMethod === 'BANK_TRANSFER' && input.paymentStatus === 'PAID';
    if (!validCod && !validTransfer)
      return { allowed: false, code: 'PAYMENT_NOT_READY' };
  }

  if (policy.requiresPaidPayment && input.paymentStatus !== 'PAID')
    return { allowed: false, code: 'PAYMENT_NOT_READY' };

  return {
    allowed: true,
    current: policy.current,
    next: policy.next,
    inventoryEffect: policy.inventoryEffect,
  };
}
