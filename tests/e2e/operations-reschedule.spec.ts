import { expect, test } from '@playwright/test';

import {
  findAppointmentRow,
  login,
  requestJson,
  selectAppointmentStatus,
  withOperationsE2eFixture,
} from './operations.helpers';

test('manager reschedule conflict preserves the successful appointment state', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const context = await newContext();
    const page = await context.newPage();
    await login(page, fixture.users.manager.email);
    await page.goto('/admin/operations');
    await page.getByRole('tab', { name: 'Lap dat' }).click();
    await selectAppointmentStatus(page, 'ASSIGNMENT_PENDING');
    let appointmentRow = await findAppointmentRow(
      page,
      fixture.appointments.pending.orderNumber,
    );
    await appointmentRow.getByRole('button', { name: 'Doi lich' }).click();
    let dialog = page.getByRole('dialog', { name: 'Doi lich lap dat' });
    await expect(
      dialog.locator('input[name="slot"]:not(:disabled)').first(),
    ).toBeVisible();
    await dialog.locator('input[name="slot"]:not(:disabled)').first().check();
    await dialog.getByLabel('Ly do doi lich').fill('E2E valid reschedule');
    await dialog.getByRole('button', { name: 'Doi lich', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Xac nhan doi lich' })
      .getByRole('button', { name: 'Xac nhan' })
      .click();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await page.getByRole('tab', { name: 'Lap dat' }).click();
    await selectAppointmentStatus(page, 'ASSIGNMENT_PENDING');
    appointmentRow = await findAppointmentRow(
      page,
      fixture.appointments.pending.orderNumber,
    );
    await appointmentRow.getByRole('button', { name: 'Doi lich' }).click();
    dialog = page.getByRole('dialog', { name: 'Doi lich lap dat' });
    await expect(
      dialog.locator('input[name="slot"]:not(:disabled)').last(),
    ).toBeVisible();
    await dialog.locator('input[name="slot"]:not(:disabled)').last().check();
    await dialog
      .getByLabel('Ly do doi lich')
      .fill('E2E unavailable reschedule');

    const reservation = await requestJson<{ data: { slotId: string } }>(
      page,
      `/api/v1/admin/operations/appointments/${fixture.appointments.fullSlot.id}/reschedule`,
      {
        method: 'POST',
        body: {
          slotId: fixture.slots.concurrentRescheduleTarget.id,
          expectedVersion: fixture.appointments.fullSlot.version,
          reason: 'Reserve the slot before the UI confirmation',
        },
      },
    );
    expect(reservation.status).toBe(200);

    await dialog.getByRole('button', { name: 'Doi lich', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Xac nhan doi lich' })
      .getByRole('button', { name: 'Xac nhan' })
      .click();
    await expect(dialog.getByRole('alert')).toContainText('SLOT_UNAVAILABLE');
    await expect(appointmentRow).toContainText('ASSIGNMENT_PENDING');
  });
});
