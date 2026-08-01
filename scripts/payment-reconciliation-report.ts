import { createHash, randomBytes } from 'node:crypto';

import {
  PaymentMethod,
  PaymentSessionStatus,
  PaymentStatus,
  PaymentWebhookOutcome,
} from '@prisma/client';

import { queryVnpayTransaction } from '@/modules/payment';
import { prisma } from '@/shared/db/client';

const limit = Number(process.env.RECONCILIATION_LIMIT ?? '50');
const ipAddress = process.env.VNPAY_RECONCILIATION_IP;
if (!Number.isInteger(limit) || limit < 1 || limit > 100)
  throw new Error('RECONCILIATION_LIMIT must be between 1 and 100.');
if (!ipAddress) throw new Error('VNPAY_RECONCILIATION_IP is required.');
const reconciliationIpAddress: string = ipAddress;

function safeReference(reference: string): string {
  return createHash('sha256').update(reference).digest('hex').slice(0, 16);
}

function exceptionType(event: {
  amount: bigint;
  currency: string;
  outcome: PaymentWebhookOutcome;
  providerTransactionId: string | null;
  payment: {
    amount: bigint;
    currency: string;
    providerTransactionId: string | null;
    status: PaymentStatus;
  };
}): string {
  if (event.outcome === PaymentWebhookOutcome.REJECTED) {
    if (event.amount !== event.payment.amount * 100n) return 'AMOUNT_MISMATCH';
    if (event.currency !== event.payment.currency) return 'CURRENCY_MISMATCH';
    return 'REJECTED_PROVIDER_CALLBACK';
  }
  if (
    event.payment.status === PaymentStatus.PAID &&
    event.providerTransactionId !== event.payment.providerTransactionId
  )
    return 'SECOND_PROVIDER_TRANSACTION';
  return 'PAYMENT_STATE_MISMATCH';
}

async function main() {
  const now = new Date();
  const sessions = await prisma.paymentSession.findMany({
    where: {
      provider: PaymentMethod.VNPAY,
      status: {
        in: [
          PaymentSessionStatus.CREATED,
          PaymentSessionStatus.PENDING,
          PaymentSessionStatus.EXPIRED,
        ],
      },
      expiresAt: { lt: now },
    },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    take: limit,
    select: {
      createdAt: true,
      providerReference: true,
      payment: {
        select: {
          amount: true,
          providerTransactionId: true,
          status: true,
        },
      },
    },
  });

  const remaining = limit - sessions.length;
  const exceptionEvents =
    remaining > 0
      ? await prisma.paymentWebhookEvent.findMany({
          where: {
            provider: PaymentMethod.VNPAY,
            outcome: {
              in: [
                PaymentWebhookOutcome.DUPLICATE,
                PaymentWebhookOutcome.REJECTED,
              ],
            },
          },
          orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
          take: remaining,
          select: {
            amount: true,
            currency: true,
            outcome: true,
            providerTransactionId: true,
            receivedAt: true,
            session: { select: { providerReference: true } },
            payment: {
              select: {
                amount: true,
                currency: true,
                providerTransactionId: true,
                status: true,
              },
            },
          },
        })
      : [];

  let discrepancies = exceptionEvents.length;
  let providerErrors = 0;
  for (const session of sessions) {
    const reference = safeReference(session.providerReference);
    try {
      const response = await queryVnpayTransaction({
        requestId: randomBytes(16).toString('hex'),
        txnRef: session.providerReference,
        transactionNo: session.payment.providerTransactionId ?? undefined,
        transactionDate: session.createdAt,
        ipAddress: reconciliationIpAddress,
        orderInfo: `Reconcile ${reference}`,
      });
      const providerPaid =
        response.vnp_ResponseCode === '00' &&
        response.vnp_TransactionStatus === '00';
      const localPaid = session.payment.status === PaymentStatus.PAID;
      const amountMatches =
        response.vnp_Amount === (session.payment.amount * 100n).toString();
      const matches = providerPaid === localPaid && amountMatches;
      if (!matches) discrepancies += 1;
      console.log(
        JSON.stringify({
          event: matches
            ? 'payment.reconciliation.match'
            : 'payment.reconciliation.discrepancy',
          reference,
          responseCode: response.vnp_ResponseCode,
          transactionStatus: response.vnp_TransactionStatus,
        }),
      );
    } catch {
      providerErrors += 1;
      console.error(
        JSON.stringify({
          event: 'payment.reconciliation.provider_error',
          reference,
          reason: 'QUERY_FAILED',
        }),
      );
    }
  }

  for (const event of exceptionEvents) {
    console.log(
      JSON.stringify({
        event: 'payment.reconciliation.exception',
        outcome: event.outcome,
        receivedAt: event.receivedAt.toISOString(),
        reference: safeReference(event.session.providerReference),
        type: exceptionType(event),
      }),
    );
  }

  console.log(
    JSON.stringify({
      check: 'payment-reconciliation',
      checked: sessions.length + exceptionEvents.length,
      discrepancies,
      providerErrors,
      reportedExceptions: exceptionEvents.length,
      status:
        discrepancies === 0 && providerErrors === 0 ? 'PASS' : 'NEEDS_REVIEW',
    }),
  );
  if (discrepancies > 0 || providerErrors > 0) process.exitCode = 2;
}

main()
  .catch(() => {
    console.error(
      JSON.stringify({
        check: 'payment-reconciliation',
        event: 'payment.reconciliation.failed',
        reason: 'EXECUTION_FAILED',
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
