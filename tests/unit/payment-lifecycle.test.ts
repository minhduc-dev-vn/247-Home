import { describe, expect, it } from 'vitest';

import {
  decideVnpayWebhookDisposition,
  isActiveOnlinePaymentSession,
} from '@/modules/payment';

describe('online payment session lifecycle', () => {
  const now = new Date('2026-07-30T10:00:00.000Z');

  it('treats only unexpired created or pending sessions as payable', () => {
    expect(
      isActiveOnlinePaymentSession({
        status: 'PENDING',
        expiresAt: new Date('2026-07-30T10:00:01.000Z'),
        now,
      }),
    ).toBe(true);
    expect(
      isActiveOnlinePaymentSession({
        status: 'PENDING',
        expiresAt: now,
        now,
      }),
    ).toBe(false);
    expect(
      isActiveOnlinePaymentSession({
        status: 'COMPLETED',
        expiresAt: new Date('2026-07-30T10:30:00.000Z'),
        now,
      }),
    ).toBe(false);
  });

  it('distinguishes an exact transaction replay from a second transaction', () => {
    expect(
      decideVnpayWebhookDisposition({
        current: 'PAID',
        next: 'PAID',
        storedProviderTransactionId: 'TXN-247',
        incomingProviderTransactionId: 'TXN-247',
      }),
    ).toEqual({ kind: 'DUPLICATE' });
    expect(
      decideVnpayWebhookDisposition({
        current: 'PAID',
        next: 'PAID',
        storedProviderTransactionId: 'TXN-247',
        incomingProviderTransactionId: 'TXN-OTHER',
      }),
    ).toEqual({
      kind: 'RECONCILIATION_EXCEPTION',
      reason: 'SECOND_PROVIDER_TRANSACTION',
    });
  });

  it('sends terminal non-paid callbacks to reconciliation instead of applying them', () => {
    expect(
      decideVnpayWebhookDisposition({
        current: 'FAILED',
        next: 'PAID',
        storedProviderTransactionId: null,
        incomingProviderTransactionId: 'TXN-LATE',
      }),
    ).toEqual({
      kind: 'RECONCILIATION_EXCEPTION',
      reason: 'PAYMENT_STATE_MISMATCH',
    });
  });
});
