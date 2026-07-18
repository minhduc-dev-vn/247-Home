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
    await page.goto('/technician/orders');
    await page.getByLabel('Trang thai').selectOption('ASSIGNED');

    await expect(
      page
        .getByTestId('technician-job-card')
        .filter({ hasText: fixture.appointments.assigned.orderNumber }),
    ).toBeVisible();
    const next = page.getByRole('button', { name: 'Trang sau' });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(
      page
        .getByTestId('technician-job-card')
        .filter({ hasText: finalJob.orderNumber }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Trang truoc' }),
    ).toBeEnabled();
  });
});

test('technician list and detail stay usable in portrait and landscape mobile layouts', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const context = await newContext();
    const page = await context.newPage();
    await login(page, fixture.users.technicianA.email);

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/technician/orders');
      await expect(
        page.getByRole('heading', { name: 'Công việc của tôi' }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
      ).toBe(false);

      await page.goto(
        `/technician/orders/${fixture.appointments.assigned.assignmentId}`,
      );
      await expect(
        page.getByRole('heading', { name: 'Chi tiết công việc' }),
      ).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'Thao tác công việc' }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
      ).toBe(false);
    }
  });
});
