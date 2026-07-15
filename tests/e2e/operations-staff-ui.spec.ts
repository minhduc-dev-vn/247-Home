import { expect, test } from '@playwright/test';

import {
  findAppointmentRow,
  login,
  requestJson,
  selectAppointmentStatus,
  withOperationsE2eFixture,
} from './operations.helpers';

test('staff cannot see management actions and the server denies assignment', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const context = await newContext();
    const page = await context.newPage();
    await login(page, fixture.users.staff.email);
    await page.goto('/admin/operations');
    await page.getByRole('tab', { name: 'Lap dat' }).click();
    await selectAppointmentStatus(page, 'ASSIGNMENT_PENDING');

    const appointmentRow = await findAppointmentRow(
      page,
      fixture.appointments.pending.orderNumber,
    );
    await expect(appointmentRow).toContainText('ASSIGNMENT_PENDING');
    await expect(
      appointmentRow.getByRole('button', { name: 'Phan cong' }),
    ).toHaveCount(0);
    await expect(
      appointmentRow.getByRole('button', { name: 'Doi lich' }),
    ).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Audit' })).toHaveCount(0);

    const denied = await requestJson<{ error: { code: string } }>(
      page,
      `/api/v1/admin/operations/appointments/${fixture.appointments.pending.id}/assign`,
      {
        method: 'POST',
        body: {
          technicianId: fixture.users.technicianA.technicianId,
          expectedVersion: fixture.appointments.pending.version,
          reason: 'Staff cannot assign technicians',
        },
      },
    );
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });
});
