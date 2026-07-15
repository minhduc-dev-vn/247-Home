import { expect, test } from '@playwright/test';

import {
  login,
  requestHeaders,
  withOperationsE2eFixture,
} from './operations.helpers';

test('authenticated Operations list and detail routes are private and non-cacheable', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const managerContext = await newContext();
    const managerPage = await managerContext.newPage();
    await login(managerPage, fixture.users.manager.email);

    const managerRoutes = [
      `/api/v1/admin/operations/technicians?appointmentId=${fixture.appointments.pending.id}&limit=1`,
      '/api/v1/admin/operations/warranties?limit=1',
      '/api/v1/admin/operations/audit?limit=1',
    ];
    for (const route of managerRoutes)
      await expect(requestHeaders(managerPage, route)).resolves.toEqual({
        cacheControl: 'private, no-store',
        status: 200,
      });

    const technicianContext = await newContext();
    const technicianPage = await technicianContext.newPage();
    await login(technicianPage, fixture.users.technicianA.email);
    await expect(
      requestHeaders(
        technicianPage,
        `/api/v1/technician/assignments/${fixture.appointments.assigned.assignmentId}`,
      ),
    ).resolves.toEqual({ cacheControl: 'private, no-store', status: 200 });
  });
});
