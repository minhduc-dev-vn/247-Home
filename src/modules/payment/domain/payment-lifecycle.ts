export type OnlinePaymentState =
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

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
