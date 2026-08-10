import { randomUUID } from 'node:crypto';

import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type IdentityActor } from '@/modules/identity';
import { transitionPayment } from '@/modules/commerce';
import {
  createOnlinePaymentSession,
  getCustomerPayment,
  processVnpayWebhook,
  signVnpayParameters,
  type VnpayParameters,
} from '@/modules/payment';
import { prisma } from '@/shared/db/client';

const secret = 'integration-test-vnpay-secret-247-home';
const tmnCode = 'TEST247';

async function createFixture() {
  const namespace = randomUUID().replaceAll('-', '');
  const [customer, otherCustomer] = await Promise.all([
    prisma.user.create({
      data: {
        email: `payment-${namespace}@example.test`,
        name: 'Payment customer',
        passwordHash: 'test-only-hash',
      },
    }),
    prisma.user.create({
      data: {
        email: `payment-other-${namespace}@example.test`,
        name: 'Other customer',
        passwordHash: 'test-only-hash',
      },
    }),
  ]);
  const order = await prisma.order.create({
    data: {
      orderNumber: `VNPAY-${namespace.toUpperCase()}`,
      userId: customer.id,
      subtotal: 1_250_000,
      installationFee: 0,
      shippingFee: 0,
      grandTotal: 1_250_000,
      recipientName: 'Payment customer',
      recipientPhone: '0900000000',
      addressLine1: '1 VNPay Street',
      wardName: 'VNPay Ward',
      districtCode: 'VNPAY-DISTRICT',
      districtName: 'VNPay District',
      provinceCode: 'VNPAY-PROVINCE',
      provinceName: 'VNPay Province',
      countryCode: 'VN',
      idempotencyHash: `vnpay-${namespace}`,
      requestFingerprint: `vnpay-${namespace}`,
      payment: {
        create: {
          method: PaymentMethod.VNPAY,
          amount: 1_250_000,
          referenceCode: `VP-${namespace.toUpperCase()}`,
        },
      },
    },
    include: { payment: true },
  });
  if (!order.payment) throw new Error('Payment fixture was not created.');
  const actor = {
    userId: customer.id,
    authVersion: 1,
    roles: ['CUSTOMER'],
  } satisfies IdentityActor;
  const otherActor = {
    userId: otherCustomer.id,
    authVersion: 1,
    roles: ['CUSTOMER'],
  } satisfies IdentityActor;

  return {
    actor,
    otherActor,
    order,
    async cleanup() {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ actorUserId: customer.id }, { targetId: order.payment!.id }],
        },
      });
      await prisma.paymentWebhookEvent.deleteMany({
        where: { paymentId: order.payment!.id },
      });
      await prisma.paymentSession.deleteMany({
        where: { paymentId: order.payment!.id },
      });
      await prisma.payment.delete({ where: { id: order.payment!.id } });
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.user.deleteMany({
        where: { id: { in: [customer.id, otherCustomer.id] } },
      });
    },
  };
}

async function withFixture(
  run: (fixture: Awaited<ReturnType<typeof createFixture>>) => Promise<void>,
) {
  const fixture = await createFixture();
  try {
    await run(fixture);
  } finally {
    await fixture.cleanup();
  }
}

function webhookFromPaymentUrl(
  paymentUrl: string,
  overrides: Partial<VnpayParameters> = {},
): VnpayParameters {
  const source = Object.fromEntries(new URL(paymentUrl).searchParams.entries());
  const unsigned: VnpayParameters = {
    vnp_Amount: source.vnp_Amount,
    vnp_BankCode: 'NCB',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: source.vnp_OrderInfo,
    vnp_PayDate: '20260722100405',
    vnp_ResponseCode: '00',
    vnp_TmnCode: tmnCode,
    vnp_TransactionNo: `TXN${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    vnp_TransactionStatus: '00',
    vnp_TxnRef: source.vnp_TxnRef,
    ...overrides,
  };
  return {
    ...unsigned,
    vnp_SecureHash: signVnpayParameters(unsigned, secret),
  };
}

beforeAll(() => {
  process.env.VNPAY_TMN_CODE = tmnCode;
  process.env.VNPAY_HASH_SECRET = secret;
  process.env.VNPAY_PAYMENT_URL =
    'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  process.env.VNPAY_RETURN_URL = 'http://127.0.0.1:3000/api/v1/payment/return';
  process.env.NEXTAUTH_URL = 'http://127.0.0.1:3000';
});

describe.sequential('online payment integration on PostgreSQL', () => {
  it('creates one owner-scoped idempotent payment session', async () => {
    await withFixture(async ({ actor, otherActor, order }) => {
      const input = { orderId: order.id, paymentMethod: 'VNPAY' as const };
      const [left, right] = await Promise.all([
        createOnlinePaymentSession(
          actor,
          input,
          'payment-key-247-home-a',
          '127.0.0.1',
          'req-a',
        ),
        createOnlinePaymentSession(
          actor,
          input,
          'payment-key-247-home-a',
          '127.0.0.1',
          'req-b',
        ),
      ]);
      expect([left.replayed, right.replayed].sort()).toEqual([false, true]);
      expect(left.payment.sessionId).toBe(right.payment.sessionId);
      await expect(
        getCustomerPayment(otherActor, order.payment!.id),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        prisma.paymentSession.count({
          where: { paymentId: order.payment!.id },
        }),
      ).resolves.toBe(1);
    });
  });

  it('applies a valid success callback once and atomically confirms the order', async () => {
    await withFixture(async ({ actor, order }) => {
      const created = await createOnlinePaymentSession(
        actor,
        { orderId: order.id, paymentMethod: 'VNPAY' },
        'payment-key-247-home-b',
        '127.0.0.1',
        'req-create',
      );
      const webhook = webhookFromPaymentUrl(created.payment.paymentUrl);
      const results = await Promise.all([
        processVnpayWebhook(webhook, 'req-webhook-a'),
        processVnpayWebhook(webhook, 'req-webhook-b'),
      ]);
      expect(results.map((item) => item.rspCode).sort()).toEqual(['00', '02']);
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: order.payment!.id } }),
      ).resolves.toMatchObject({
        status: PaymentStatus.PAID,
        version: order.payment!.version + 2,
        providerTransactionId: webhook.vnp_TransactionNo,
      });
      await expect(
        prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      ).resolves.toMatchObject({
        status: 'CONFIRMED',
        version: order.version + 1,
      });
      await expect(
        prisma.paymentWebhookEvent.count({
          where: { paymentId: order.payment!.id },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.auditLog.count({
          where: { targetId: order.payment!.id, action: 'payment.vnpay_paid' },
        }),
      ).resolves.toBe(1);
    });
  });

  it('rejects tampered signatures and amount mismatches without state changes', async () => {
    await withFixture(async ({ actor, order }) => {
      const created = await createOnlinePaymentSession(
        actor,
        { orderId: order.id, paymentMethod: 'VNPAY' },
        'payment-key-247-home-c',
        '127.0.0.1',
        'req-create',
      );
      const valid = webhookFromPaymentUrl(created.payment.paymentUrl);
      await expect(
        processVnpayWebhook({ ...valid, vnp_Amount: '1' }, 'req-tampered'),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const mismatched = webhookFromPaymentUrl(created.payment.paymentUrl, {
        vnp_Amount: '1',
      });
      await expect(
        processVnpayWebhook(mismatched, 'req-amount'),
      ).resolves.toEqual({
        rspCode: '04',
        message: 'Invalid amount',
      });
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: order.payment!.id } }),
      ).resolves.toMatchObject({ status: PaymentStatus.PROCESSING });
      await expect(
        prisma.paymentWebhookEvent.count({
          where: { paymentId: order.payment!.id },
        }),
      ).resolves.toBe(0);
    });
  });

  it('records a signed failed callback without confirming the order', async () => {
    await withFixture(async ({ actor, order }) => {
      const created = await createOnlinePaymentSession(
        actor,
        { orderId: order.id, paymentMethod: 'VNPAY' },
        'payment-key-247-home-d',
        '127.0.0.1',
        'req-create',
      );
      const webhook = webhookFromPaymentUrl(created.payment.paymentUrl, {
        vnp_ResponseCode: '24',
        vnp_TransactionStatus: '02',
      });
      await expect(processVnpayWebhook(webhook, 'req-failed')).resolves.toEqual(
        {
          rspCode: '00',
          message: 'Confirm Success',
        },
      );
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: order.payment!.id } }),
      ).resolves.toMatchObject({ status: PaymentStatus.FAILED });
      await expect(
        prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      ).resolves.toMatchObject({ status: 'PENDING_CONFIRMATION' });
    });
  });

  it('does not allow a manager to manually mark VNPay as paid', async () => {
    await withFixture(async ({ order, otherActor }) => {
      await expect(
        transitionPayment(
          { ...otherActor, roles: ['MANAGER'] },
          order.payment!.id,
          'CONFIRM_PAYMENT',
          order.payment!.version,
          'Manual online confirmation must be rejected',
          'FAKE-VNPAY-REFERENCE',
          'req-manual-vnpay',
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: order.payment!.id } }),
      ).resolves.toMatchObject({
        status: PaymentStatus.PENDING,
        version: order.payment!.version,
      });
    });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
