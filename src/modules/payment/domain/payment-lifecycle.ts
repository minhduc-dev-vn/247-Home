export type OnlinePaymentState =
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type OnlinePaymentSessionState =
  'CREATED' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export const activeOnlinePaymentSessionStates = ['CREATED', 'PENDING'] as const;

export function isActiveOnlinePaymentSession(input: {
  expiresAt: Date;
  now: Date;
  status: OnlinePaymentSessionState;
}): boolean {
  return (
    activeOnlinePaymentSessionStates.includes(
      input.status as (typeof activeOnlinePaymentSessionStates)[number],
    ) && input.expiresAt.getTime() > input.now.getTime()
  );
}

export function canStartOnlinePayment(state: OnlinePaymentState): boolean {
  return state === 'CREATED' || state === 'PENDING' || state === 'PROCESSING';
}

export function webhookPaymentOutcome(input: {
  responseCode: string;
  transactionStatus: string;
}): 'PAID' | 'FAILED' {
  return input.responseCode === '00' && input.transactionStatus === '00'
    ? 'PAID'
    : 'FAILED';
}

export function canApplyWebhookOutcome(
  current: OnlinePaymentState,
  next: 'PAID' | 'FAILED',
): boolean {
  if (current === next) return false;
  return ['CREATED', 'PENDING', 'PROCESSING'].includes(current);
}

export type VnpayWebhookDisposition =
  | { kind: 'APPLY' }
  | { kind: 'DUPLICATE' }
  | {
      kind: 'RECONCILIATION_EXCEPTION';
      reason: 'PAYMENT_STATE_MISMATCH' | 'SECOND_PROVIDER_TRANSACTION';
    };

// Exact signed-event replay is handled by the event ledger before this policy.
// This policy classifies a new signed callback against the current aggregate.
export function decideVnpayWebhookDisposition(input: {
  current: OnlinePaymentState;
  incomingProviderTransactionId: string;
  next: 'PAID' | 'FAILED';
  storedProviderTransactionId: string | null;
}): VnpayWebhookDisposition {
  if (canApplyWebhookOutcome(input.current, input.next))
    return { kind: 'APPLY' };

  if (
    input.current === 'PAID' &&
    input.storedProviderTransactionId === input.incomingProviderTransactionId
  )
    return { kind: 'DUPLICATE' };

  return {
    kind: 'RECONCILIATION_EXCEPTION',
    reason:
      input.current === 'PAID'
        ? 'SECOND_PROVIDER_TRANSACTION'
        : 'PAYMENT_STATE_MISMATCH',
  };
}
