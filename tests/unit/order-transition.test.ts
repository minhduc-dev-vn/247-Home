import { describe, expect, it } from 'vitest';

import { decideOrderTransition, type OrderAction } from '@/modules/commerce';
import { type IdentityActor } from '@/modules/identity';

const manager: IdentityActor = {
  userId: 'manager',
  authVersion: 1,
  roles: ['MANAGER'],
};

function decide(
  action: OrderAction,
  overrides: Partial<Parameters<typeof decideOrderTransition>[0]> = {},
) {
  return decideOrderTransition({
    actor: manager,
    action,
    current: 'PENDING_CONFIRMATION',
    inventoryStatus: 'RESERVED',
    hasAppointment: false,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    ...overrides,
  });
}

describe('order transition policy', () => {
  it.each([
    ['confirm', 'PENDING_CONFIRMATION', 'CONFIRMED', 'RESERVED', 'NONE'],
    ['start-processing', 'CONFIRMED', 'PROCESSING', 'RESERVED', 'NONE'],
    [
      'mark-ready-for-installation',
      'PROCESSING',
      'READY_FOR_INSTALLATION',
      'RESERVED',
      'CONSUME_RESERVED',
    ],
    [
      'complete-without-installation',
      'READY_FOR_INSTALLATION',
      'COMPLETED',
      'CONSUMED',
      'NONE',
    ],
  ] as const)(
    'allows %s from its one valid state',
    (action, current, next, inventoryStatus, inventoryEffect) => {
      expect(
        decide(action, {
          current,
          inventoryStatus,
          paymentStatus: 'PAID',
        }),
      ).toEqual({ allowed: true, current, next, inventoryEffect });
    },
  );

  it('requires paid bank transfer before confirmation', () => {
    expect(
      decide('confirm', {
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'PENDING',
      }),
    ).toEqual({ allowed: false, code: 'PAYMENT_NOT_READY' });
  });

  it('requires a verified paid VNPay payment before confirmation', () => {
    expect(
      decide('confirm', {
        paymentMethod: 'VNPAY',
        paymentStatus: 'PROCESSING',
      }),
    ).toEqual({ allowed: false, code: 'PAYMENT_NOT_READY' });
    expect(
      decide('confirm', {
        paymentMethod: 'VNPAY',
        paymentStatus: 'PAID',
      }),
    ).toMatchObject({ allowed: true, next: 'CONFIRMED' });
  });

  it('requires paid payment and no appointment for completion', () => {
    expect(
      decide('complete-without-installation', {
        current: 'READY_FOR_INSTALLATION',
        inventoryStatus: 'CONSUMED',
        paymentStatus: 'PENDING',
      }),
    ).toEqual({ allowed: false, code: 'PAYMENT_NOT_READY' });
    expect(
      decide('complete-without-installation', {
        current: 'READY_FOR_INSTALLATION',
        inventoryStatus: 'CONSUMED',
        paymentStatus: 'PAID',
        hasAppointment: true,
      }),
    ).toEqual({ allowed: false, code: 'INVALID_STATE_TRANSITION' });
  });

  it('rejects invalid state, inventory lifecycle, and actor', () => {
    expect(
      decide('mark-ready-for-installation', { current: 'CONFIRMED' }),
    ).toEqual({ allowed: false, code: 'INVALID_STATE_TRANSITION' });
    expect(
      decide('mark-ready-for-installation', {
        current: 'PROCESSING',
        inventoryStatus: 'CONSUMED',
      }),
    ).toEqual({ allowed: false, code: 'INVENTORY_NOT_RESERVED' });
    expect(decide('confirm', { actor: null })).toEqual({
      allowed: false,
      code: 'UNAUTHENTICATED',
    });
  });
});
