import { createHash, randomBytes } from 'node:crypto';

import {
  PaymentMethod,
  PaymentSessionStatus,
  PaymentStatus,
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

async function main() {
  const sessions = await prisma.paymentSession.findMany({
    where: {
      provider: PaymentMethod.VNPAY,
      status: {
        in: [PaymentSessionStatus.CREATED, PaymentSessionStatus.PENDING],
      },
      expiresAt: { lt: new Date() },
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

  let discrepancies = 0;
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
    } catch (error) {
      providerErrors += 1;
      console.error(
        JSON.stringify({
          event: 'payment.reconciliation.provider_error',
          reference,
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }

  console.log(
    JSON.stringify({
      check: 'payment-reconciliation',
      checked: sessions.length,
      discrepancies,
      providerErrors,
      status:
        discrepancies === 0 && providerErrors === 0 ? 'PASS' : 'NEEDS_REVIEW',
    }),
  );
  if (discrepancies > 0 || providerErrors > 0) process.exitCode = 2;
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Reconciliation failed',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
