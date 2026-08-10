import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { expect, test } from '@playwright/test';

import { signVnpayParameters, type VnpayParameters } from '@/modules/payment';
import { prisma } from '@/shared/db/client';

import { login, withOperationsE2eFixture } from './operations.helpers';

const hashSecret = 'playwright-test-vnpay-secret-247-home';

test('customer creates VNPay payment and sees verified webhook result', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const appointment = await fixture.createAppointment({
      customer: fixture.users.customerA,
      paymentStatus: PaymentStatus.PENDING,
    });
    await prisma.payment.update({
      where: { id: appointment.paymentId },
      data: { method: PaymentMethod.VNPAY },
    });

    const context = await newContext();
    const page = await context.newPage();
    await login(page, fixture.users.customerA.email);
    const created = await page.evaluate(async (orderId) => {
      const response = await fetch('/api/v1/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `e2e-vnpay-${orderId}`,
        },
        body: JSON.stringify({ orderId, paymentMethod: 'VNPAY' }),
      });
      return {
        status: response.status,
        payload: (await response.json()) as {
          data: { id: string; paymentUrl: string; status: string };
        },
      };
    }, appointment.orderId);

    expect(created.status).toBe(201);
    expect(created.payload.data).toMatchObject({
      id: appointment.paymentId,
      status: 'PROCESSING',
    });
    const redirect = new URL(created.payload.data.paymentUrl);
    expect(redirect.origin).toBe('https://sandbox.vnpayment.vn');
    expect(redirect.searchParams.get('vnp_SecureHash')).toMatch(
      /^[a-f0-9]{128}$/,
    );

    const source = Object.fromEntries(redirect.searchParams.entries());
    const unsigned: VnpayParameters = {
      vnp_Amount: source.vnp_Amount,
      vnp_BankCode: 'NCB',
      vnp_CardType: 'ATM',
      vnp_OrderInfo: source.vnp_OrderInfo,
      vnp_PayDate: '20260722100405',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'TEST247',
      vnp_TransactionNo: `E2E${fixture.namespace.slice(-16)}`,
      vnp_TransactionStatus: '00',
      vnp_TxnRef: source.vnp_TxnRef,
    };
    const webhook = new URL('/api/v1/payment/webhook', 'http://127.0.0.1:3000');
    for (const [key, value] of Object.entries({
      ...unsigned,
      vnp_SecureHash: signVnpayParameters(unsigned, hashSecret),
    }))
      webhook.searchParams.set(key, value);

    const callback = await page.request.get(webhook.toString());
    expect(callback.status()).toBe(200);
    await expect(callback.json()).resolves.toEqual({
      RspCode: '00',
      Message: 'Confirm Success',
    });

    await page.goto(`/payment/success?paymentId=${appointment.paymentId}`);
    await expect(
      page.getByRole('heading', { name: 'Thanh toán thành công' }),
    ).toBeVisible();
    await expect(page.getByText(appointment.orderNumber)).toBeVisible();
    await expect(page.getByText('PAID', { exact: true })).toBeVisible();

    await expect(
      prisma.auditLog.count({
        where: {
          targetId: appointment.paymentId,
          action: 'payment.vnpay_paid',
        },
      }),
    ).resolves.toBe(1);
  });
});
