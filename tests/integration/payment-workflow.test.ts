import { randomUUID } from 'node:crypto';

import { PaymentMethod, PaymentStatus, type OrderStatus } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { transitionPayment } from '@/modules/commerce';
import { type IdentityActor } from '@/modules/identity';
import { prisma } from '@/shared/db/client';

async function createPaymentFixture(
  status: PaymentStatus = PaymentStatus.PENDING,
) {
  const namespace = randomUUID().replaceAll('-', '');
  const [manager, customer] = await Promise.all([
    prisma.user.create({
      data: {
        email: `payment-manager-${namespace}@example.test`,
        name: 'Payment manager',
        passwordHash: 'test-only-hash',
      },
    }),
    prisma.user.create({
      data: {
        email: `payment-customer-${namespace}@example.test`,
        name: 'Payment customer',
        passwordHash: 'test-only-hash',
      },
    }),
  ]);
  const order = await prisma.order.create({
    data: {
      orderNumber: `PAYMENT-${namespace.toUpperCase()}`,
      userId: customer.id,
      status: 'PENDING_CONFIRMATION' as OrderStatus,
      subtotal: 100_000,
      installationFee: 0,
      shippingFee: 0,
      grandTotal: 100_000,
      recipientName: 'Payment customer',
      recipientPhone: '0900000000',
      addressLine1: '1 Payment Street',
      wardName: 'Payment Ward',
      districtCode: 'PAYMENT-DISTRICT',
      districtName: 'Payment District',
      provinceCode: 'PAYMENT-PROVINCE',
      provinceName: 'Payment Province',
      countryCode: 'VN',
      idempotencyHash: `payment-${namespace}`,
      requestFingerprint: `payment-${namespace}`,
      payment: {
        create: {
          method: PaymentMethod.BANK_TRANSFER,
          status,
          amount: 100_000,
          referenceCode: `PAY-${namespace.toUpperCase()}`,
        },
      },
    },
    include: { payment: true },
  });
  if (!order.payment) throw new Error('Payment fixture was not created.');

  return {
    actor: {
      userId: manager.id,
      authVersion: 1,
      roles: ['MANAGER'],
    } satisfies IdentityActor,
    payment: order.payment,
    async cleanup() {
      await prisma.auditLog.deleteMany({
        where: { targetId: order.payment!.id },
      });
      await prisma.payment.delete({ where: { id: order.payment!.id } });
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.user.deleteMany({
        where: { id: { in: [manager.id, customer.id] } },
      });
    },
  };
}

async function withFixture(
  run: (
    fixture: Awaited<ReturnType<typeof createPaymentFixture>>,
  ) => Promise<void>,
) {
  const fixture = await createPaymentFixture();
  try {
    await run(fixture);
  } finally {
    await fixture.cleanup();
  }
}

describe.sequential('manual payment transitions on PostgreSQL', () => {
  it('allows only one concurrent confirmation and writes one audit event', async () => {
    await withFixture(async ({ actor, payment }) => {
      const requestIds = [randomUUID(), randomUUID()];
      const results = await Promise.allSettled(
        requestIds.map((requestId) =>
          transitionPayment(
            actor,
            payment.id,
            'CONFIRM_PAYMENT',
            payment.version,
            'Bank transfer verified',
            'BANK-REF-247',
            requestId,
          ),
        ),
      );
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      expect(rejected?.reason).toMatchObject({
        code: 'CONCURRENT_MODIFICATION',
      });
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      ).resolves.toMatchObject({
        status: PaymentStatus.PAID,
        version: payment.version + 1,
        confirmationReference: 'BANK-REF-247',
      });
      await expect(
        prisma.auditLog.count({
          where: { targetId: payment.id, action: 'payment.confirm_payment' },
        }),
      ).resolves.toBe(1);
    });
  });

  it('rejects a second transition from a terminal payment state', async () => {
    await withFixture(async ({ actor, payment }) => {
      await transitionPayment(
        actor,
        payment.id,
        'REJECT_PAYMENT',
        payment.version,
        'Transfer proof rejected',
        undefined,
        randomUUID(),
      );
      await expect(
        transitionPayment(
          actor,
          payment.id,
          'CONFIRM_PAYMENT',
          payment.version + 1,
          'Retry after rejection',
          undefined,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
      await expect(
        prisma.auditLog.count({ where: { targetId: payment.id } }),
      ).resolves.toBe(1);
    });
  });

  it('does not confirm a payment whose amount differs from its order total', async () => {
    await withFixture(async ({ actor, payment }) => {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { amount: 99_999 },
      });

      await expect(
        transitionPayment(
          actor,
          payment.id,
          'CONFIRM_PAYMENT',
          payment.version,
          'Mismatched transfer must not be accepted',
          'BANK-MISMATCH-247',
          randomUUID(),
        ),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'PAYMENT_AMOUNT_MISMATCH',
      });
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      ).resolves.toMatchObject({
        status: PaymentStatus.PENDING,
        version: payment.version,
        confirmationReference: null,
      });
      await expect(
        prisma.auditLog.count({ where: { targetId: payment.id } }),
      ).resolves.toBe(0);
    });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
