import { expect, test } from '@playwright/test';
import { AppointmentStatus } from '@prisma/client';

import { login, withOperationsE2eFixture } from './operations.helpers';

test('technician filters and paginates only their own assignments', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const extraJobs = [];
    for (let index = 0; index < 10; index += 1) {
      extraJobs.push(
        await fixture.createAppointment({
          assignedTechnician: fixture.users.technicianA,
          status: AppointmentStatus.ASSIGNED,
        }),
      );
    }
    const finalJob = extraJobs.at(-1);
    if (!finalJob)
      throw new Error('Technician pagination fixture was not created.');
    const context = await newContext();
    const page = await context.newPage();
    await login(page, fixture.users.technicianA.email);
    await page.goto('/technician');
    await page.getByLabel('Trang thai').selectOption('ASSIGNED');

    await expect(
      page.getByText(fixture.appointments.assigned.orderNumber),
    ).toBeVisible();
    const next = page.getByRole('button', { name: 'Trang sau' });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.getByText(finalJob.orderNumber)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Trang truoc' }),
    ).toBeEnabled();
  });
});
