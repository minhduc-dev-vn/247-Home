import { expect, test } from '@playwright/test';

import {
  findAppointmentRow,
  login,
  selectAppointmentStatus,
  withOperationsE2eFixture,
} from './operations.helpers';

test('manager assigns only a suitable technician and the assignment is audited', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const context = await newContext();
    const page = await context.newPage();
    await login(page, fixture.users.manager.email);
    await page.goto('/admin/operations');
    await expect(
      page.getByRole('heading', { name: 'Operations' }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Lap dat' }).click();
    await selectAppointmentStatus(page, 'ASSIGNMENT_PENDING');
    const appointmentRow = await findAppointmentRow(
      page,
      fixture.appointments.pending.orderNumber,
    );
    await expect(appointmentRow).toContainText('ASSIGNMENT_PENDING');
    await appointmentRow.getByRole('button', { name: 'Phan cong' }).click();

    const dialog = page.getByRole('dialog', {
      name: 'Phan cong ky thuat vien',
    });
    await expect(dialog.getByText('Fixture Technician A')).toBeVisible();
    await expect(dialog.getByText('Fixture Technician B')).toBeVisible();
    await expect(dialog.getByText('Fixture Technician Other Area')).toHaveCount(
      0,
    );
    await expect(dialog.getByText('Fixture Technician Inactive')).toHaveCount(
      0,
    );
    await dialog.getByLabel('Fixture Technician B').check();
    await dialog.getByLabel('Ly do phan cong').fill('E2E manager assignment');
    await dialog
      .getByRole('button', { name: 'Phan cong', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Xac nhan phan cong' })
      .getByRole('button', { name: 'Xac nhan' })
      .click();

    await expect(dialog).toHaveCount(0);
    await selectAppointmentStatus(page, 'ASSIGNED');
    const assignedRow = await findAppointmentRow(
      page,
      fixture.appointments.pending.orderNumber,
    );
    await expect(assignedRow).toContainText('ASSIGNED');
    await expect(assignedRow).toContainText('Fixture Technician B');
    await page.getByRole('tab', { name: 'Audit' }).click();
    await expect(
      page.getByText('operations.technician-assigned'),
    ).toBeVisible();
  });
});
