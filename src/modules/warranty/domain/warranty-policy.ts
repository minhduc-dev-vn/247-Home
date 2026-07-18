export const warrantyCoverageTypes = ['DEVICE', 'INSTALLATION'] as const;
export type WarrantyCoverageTypeValue = (typeof warrantyCoverageTypes)[number];

export const warrantyStates = [
  'SUBMITTED',
  'IN_REVIEW',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
] as const;
export type WarrantyState = (typeof warrantyStates)[number];

export type WarrantyPolicyRole =
  'CUSTOMER' | 'STAFF' | 'TECHNICIAN' | 'MANAGER' | 'ADMIN';

export type WarrantyTransitionDecision =
  | { allowed: true }
  | { allowed: false; code: 'FORBIDDEN' | 'INVALID_STATE_TRANSITION' };

export function hasDuplicateWarrantyCoverage(
  existingCoverageTypes: readonly WarrantyCoverageTypeValue[],
  requestedCoverageType: WarrantyCoverageTypeValue,
): boolean {
  return existingCoverageTypes.includes(requestedCoverageType);
}

export function decideWarrantyTransition(input: {
  currentStatus: WarrantyState;
  nextStatus: WarrantyState;
  roles: readonly WarrantyPolicyRole[];
  isOwner: boolean;
}): WarrantyTransitionDecision {
  if (input.roles.includes('ADMIN') || input.roles.includes('TECHNICIAN')) {
    return { allowed: false, code: 'FORBIDDEN' };
  }

  if (input.roles.includes('STAFF') || input.roles.includes('MANAGER')) {
    const allowed =
      (input.currentStatus === 'SUBMITTED' &&
        input.nextStatus === 'IN_REVIEW') ||
      (input.currentStatus === 'IN_REVIEW' &&
        (input.nextStatus === 'RESOLVED' || input.nextStatus === 'REJECTED'));
    return allowed
      ? { allowed: true }
      : { allowed: false, code: 'INVALID_STATE_TRANSITION' };
  }

  if (!input.roles.includes('CUSTOMER') || !input.isOwner) {
    return { allowed: false, code: 'FORBIDDEN' };
  }

  return (input.currentStatus === 'RESOLVED' ||
    input.currentStatus === 'REJECTED') &&
    input.nextStatus === 'CLOSED'
    ? { allowed: true }
    : { allowed: false, code: 'INVALID_STATE_TRANSITION' };
}

function addCalendarMonths(value: Date, months: number): Date {
  const result = new Date(value);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export type WarrantyEligibilityDecision =
  | { eligible: true; startsAt: Date; expiresAt: Date }
  | {
      eligible: false;
      reason:
        | 'ORDER_NOT_COMPLETED'
        | 'NO_COMPLETION_DATE'
        | 'NO_INSTALLATION_PACKAGE'
        | 'NO_WARRANTY_TERM'
        | 'WARRANTY_EXPIRED';
    };

export function evaluateWarrantyEligibility(input: {
  orderStatus: string;
  completedAt: Date | null;
  warrantyMonths: number;
  hasServicePackage: boolean;
  coverageType: WarrantyCoverageTypeValue;
  now: Date;
}): WarrantyEligibilityDecision {
  if (input.orderStatus !== 'COMPLETED') {
    return { eligible: false, reason: 'ORDER_NOT_COMPLETED' };
  }
  if (!input.completedAt) {
    return { eligible: false, reason: 'NO_COMPLETION_DATE' };
  }
  if (input.coverageType === 'INSTALLATION' && !input.hasServicePackage) {
    return { eligible: false, reason: 'NO_INSTALLATION_PACKAGE' };
  }
  if (input.warrantyMonths <= 0) {
    return { eligible: false, reason: 'NO_WARRANTY_TERM' };
  }
  const expiresAt = addCalendarMonths(input.completedAt, input.warrantyMonths);
  if (expiresAt.getTime() < input.now.getTime()) {
    return { eligible: false, reason: 'WARRANTY_EXPIRED' };
  }
  return { eligible: true, startsAt: input.completedAt, expiresAt };
}
