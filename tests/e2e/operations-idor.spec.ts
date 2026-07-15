import { expect, test } from '@playwright/test';

import {
  login,
  requestJson,
  withOperationsE2eFixture,
} from './operations.helpers';

test('a different technician cannot read or transition another technician assignment', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const context = await newContext();
    const page = await context.newPage();
    await login(page, fixture.users.technicianB.email);
    await page.goto('/technician');
    await expect(
      page.getByText(fixture.appointments.assigned.orderNumber),
    ).toHaveCount(0);

    const detail = await requestJson<{ error: { code: string } }>(
      page,
      `/api/v1/technician/assignments/${fixture.appointments.assigned.assignmentId}`,
    );
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('NOT_FOUND');

    for (const action of ['start', 'complete'] as const) {
      const mutation = await requestJson<{ error: { code: string } }>(
        page,
        `/api/v1/technician/assignments/${fixture.appointments.assigned.assignmentId}/actions`,
        {
          method: 'POST',
          body: {
            action,
            expectedVersion: fixture.appointments.assigned.version,
            ...(action === 'complete' ? { note: 'Unauthorized attempt' } : {}),
          },
        },
      );
      expect(mutation.status).toBe(404);
      expect(mutation.body.error.code).toBe('NOT_FOUND');
    }
  });
});
