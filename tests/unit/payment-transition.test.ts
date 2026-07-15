import { describe, expect, it } from 'vitest';

import { decidePaymentTransition } from '@/modules/commerce';
import { type IdentityActor } from '@/modules/identity';

const manager: IdentityActor = {
  userId: 'manager',
  authVersion: 1,
  roles: ['MANAGER'],
};

describe('payment transition policy', () => {
  it('allows confirm and reject only from pending', () => {
    expect(
      decidePaymentTransition({
        actor: manager,
        action: 'CONFIRM_PAYMENT',
        current: 'PENDING',
      }),
    ).toEqual({ allowed: true, current: 'PENDING', next: 'PAID' });
    expect(
      decidePaymentTransition({
        actor: manager,
        action: 'REJECT_PAYMENT',
        current: 'PENDING',
      }),
    ).toEqual({ allowed: true, current: 'PENDING', next: 'FAILED' });
    expect(
      decidePaymentTransition({
        actor: manager,
        action: 'CONFIRM_PAYMENT',
        current: 'PAID',
      }),
    ).toEqual({ allowed: false, code: 'INVALID_STATE_TRANSITION' });
  });

  it('rejects customer actors', () => {
    expect(
      decidePaymentTransition({
        actor: { ...manager, roles: ['CUSTOMER'] },
        action: 'CONFIRM_PAYMENT',
        current: 'PENDING',
      }),
    ).toEqual({ allowed: false, code: 'FORBIDDEN' });
  });
});
