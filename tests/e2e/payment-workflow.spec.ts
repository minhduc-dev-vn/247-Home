import { expect, test } from '@playwright/test';

import {
  login,
  requestJson,
  withOperationsE2eFixture,
} from './operations.helpers';

test('manager confirms a pending payment once and stale version conflicts', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const pending = await fixture.createAppointment({
      paymentStatus: 'PENDING',
    });
    const context = await newContext();
    const page = await context.newPage();
    await login(page, fixture.users.manager.email);
    const actionsUrl = `/api/v1/admin/payments/${pending.paymentId}/actions`;

    const confirmed = await requestJson<{
      data: { status: string; version: number };
    }>(page, actionsUrl, {
      method: 'POST',
      body: {
        action: 'CONFIRM_PAYMENT',
        expectedVersion: pending.paymentVersion,
        reference: 'E2E-BANK-REF-247',
        reason: 'Bank transfer reconciled',
      },
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data).toMatchObject({
      status: 'PAID',
      version: pending.paymentVersion + 1,
    });

    const stale = await requestJson<{ error: { code: string } }>(
      page,
      actionsUrl,
      {
        method: 'POST',
        body: {
          action: 'CONFIRM_PAYMENT',
          expectedVersion: pending.paymentVersion,
          reason: 'Stale retry',
        },
      },
    );
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONCURRENT_MODIFICATION');

    const audit = await requestJson<{
      data: { items: Array<{ action: string; targetId: string }> };
    }>(
      page,
      `/api/v1/admin/operations/audit?limit=25&targetId=${pending.paymentId}`,
    );
    expect(audit.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'payment.confirm_payment',
          targetId: pending.paymentId,
        }),
      ]),
    );
  });
});
