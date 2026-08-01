import { type IdentityActor } from '@/modules/identity';

export const orderActions = [
  'confirm',
  'start-processing',
  'mark-ready-for-installation',
  'complete-without-installation',
  'cancel',
  'expire',
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
export type PaymentMethodState = 'COD' | 'BANK_TRANSFER' | 'VNPAY';
export type PaymentState =
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

export type AppointmentState =
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

export const orderActionLabels: Record<OrderAction, string> = {
  confirm: 'Xac nhan don',
  'start-processing': 'Bat dau xu ly',
  'mark-ready-for-installation': 'San sang lap dat',
  'complete-without-installation': 'Hoan thanh khong lap dat',
  cancel: 'Huy don',
  expire: 'Het han don chua thanh toan',
};

const orderOperationsRoles: readonly string[] = ['STAFF', 'MANAGER', 'ADMIN'];
const orderManagementRoles: readonly string[] = ['MANAGER', 'ADMIN'];
const customerCancellableAppointmentStates: readonly AppointmentState[] = [
  'SCHEDULED',
  'ASSIGNMENT_PENDING',
];
const operationsCancellableAppointmentStates: readonly AppointmentState[] = [
  ...customerCancellableAppointmentStates,
  'ASSIGNED',
  'RESCHEDULE_REQUIRED',
];

export type InventoryEffect = 'NONE' | 'CONSUME_RESERVED' | 'RELEASE_RESERVED';
export type AppointmentEffect = 'CANCEL_AND_RELEASE_CAPACITY';
export type PaymentEffect = 'CANCEL_UNPAID';
type Policy = {
  current: readonly OrderState[];
  next: OrderState;
  expectedInventory: InventoryState;
  inventoryEffect: InventoryEffect;
  appointmentEffect?: AppointmentEffect;
  paymentEffect?: PaymentEffect;
  requiresUnpaidPayment?: boolean;
  requiresInactiveOnlinePaymentSession?: boolean;
  requiresNoAppointment?: boolean;
  requiresPaidPayment?: boolean;
};

const policies: Record<OrderAction, Policy> = {
  confirm: {
    current: ['PENDING_CONFIRMATION'],
    next: 'CONFIRMED',
    expectedInventory: 'RESERVED',
    inventoryEffect: 'NONE',
  },
  'start-processing': {
    current: ['CONFIRMED'],
    next: 'PROCESSING',
    expectedInventory: 'RESERVED',
    inventoryEffect: 'NONE',
  },
  'mark-ready-for-installation': {
    current: ['PROCESSING'],
    next: 'READY_FOR_INSTALLATION',
    expectedInventory: 'RESERVED',
    inventoryEffect: 'CONSUME_RESERVED',
  },
  'complete-without-installation': {
    current: ['READY_FOR_INSTALLATION'],
    next: 'COMPLETED',
    expectedInventory: 'CONSUMED',
    inventoryEffect: 'NONE',
    requiresNoAppointment: true,
    requiresPaidPayment: true,
  },
  cancel: {
    current: ['PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING'],
    next: 'CANCELLED',
    expectedInventory: 'RESERVED',
    inventoryEffect: 'RELEASE_RESERVED',
    appointmentEffect: 'CANCEL_AND_RELEASE_CAPACITY',
    paymentEffect: 'CANCEL_UNPAID',
    requiresUnpaidPayment: true,
    requiresInactiveOnlinePaymentSession: true,
  },
  expire: {
    current: ['PENDING_CONFIRMATION'],
    next: 'CANCELLED',
    expectedInventory: 'RESERVED',
    inventoryEffect: 'RELEASE_RESERVED',
    appointmentEffect: 'CANCEL_AND_RELEASE_CAPACITY',
    paymentEffect: 'CANCEL_UNPAID',
    requiresUnpaidPayment: true,
    requiresInactiveOnlinePaymentSession: true,
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
      appointmentEffect?: AppointmentEffect;
      paymentEffect?: PaymentEffect;
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
  appointmentStatus: AppointmentState | null;
  isOwner: boolean;
  hasActiveOnlinePaymentSession: boolean;
  paymentMethod: PaymentMethodState | null;
  paymentStatus: PaymentState | null;
}): OrderTransitionDecision {
  const policy = policies[input.action];
  if (!policy.current.includes(input.current))
    return { allowed: false, code: 'INVALID_STATE_TRANSITION' };
  if (!input.actor) return { allowed: false, code: 'UNAUTHENTICATED' };

  const isManagement = input.actor.roles.some((role) =>
    orderManagementRoles.includes(role),
  );
  const isOperations = input.actor.roles.some((role) =>
    orderOperationsRoles.includes(role),
  );
  const isCustomer = input.actor.roles.includes('CUSTOMER');

  if (input.action === 'cancel') {
    if (!isOperations && !isCustomer)
      return { allowed: false, code: 'FORBIDDEN' };
    if (!isOperations && !input.isOwner)
      return { allowed: false, code: 'FORBIDDEN' };
    if (!isOperations && input.current !== 'PENDING_CONFIRMATION')
      return { allowed: false, code: 'INVALID_STATE_TRANSITION' };
    if (!isManagement && input.current === 'PROCESSING')
      return { allowed: false, code: 'FORBIDDEN' };
    if (
      input.appointmentStatus &&
      !(
        isOperations
          ? operationsCancellableAppointmentStates
          : customerCancellableAppointmentStates
      ).includes(input.appointmentStatus)
    )
      return { allowed: false, code: 'INVALID_STATE_TRANSITION' };
  } else if (input.action === 'expire') {
    if (!isManagement) return { allowed: false, code: 'FORBIDDEN' };
    if (
      input.appointmentStatus &&
      !customerCancellableAppointmentStates.includes(input.appointmentStatus)
    )
      return { allowed: false, code: 'INVALID_STATE_TRANSITION' };
  } else {
    const actorDecision = authorizeOrderActor(input.actor);
    if (!actorDecision.allowed) return actorDecision;
  }

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
    const validOnline =
      input.paymentMethod === 'VNPAY' && input.paymentStatus === 'PAID';
    if (!validCod && !validTransfer && !validOnline)
      return { allowed: false, code: 'PAYMENT_NOT_READY' };
  }

  if (policy.requiresPaidPayment && input.paymentStatus !== 'PAID')
    return { allowed: false, code: 'PAYMENT_NOT_READY' };
  if (
    policy.requiresUnpaidPayment &&
    (!input.paymentStatus ||
      input.paymentStatus === 'PAID' ||
      input.paymentStatus === 'REFUNDED')
  )
    return { allowed: false, code: 'PAYMENT_NOT_READY' };
  if (
    policy.requiresInactiveOnlinePaymentSession &&
    input.hasActiveOnlinePaymentSession
  )
    return { allowed: false, code: 'PAYMENT_NOT_READY' };

  return {
    allowed: true,
    current: input.current,
    next: policy.next,
    inventoryEffect: policy.inventoryEffect,
    ...(policy.appointmentEffect
      ? { appointmentEffect: policy.appointmentEffect }
      : {}),
    ...(policy.paymentEffect ? { paymentEffect: policy.paymentEffect } : {}),
  };
}
