import { expect, test, type Locator, type Page } from '@playwright/test';

import { login, withOperationsE2eFixture } from './operations.helpers';

async function findOrderRow(page: Page, orderNumber: string): Promise<Locator> {
  for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
    const row = page.locator('tbody tr', { hasText: orderNumber });
    if ((await row.count()) > 0) return row;
    const next = page.getByRole('button', { name: 'Trang sau' });
    if (await next.isDisabled()) break;
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.status() === 200 &&
          response.url().includes('/api/v1/admin/operations/orders') &&
          new URL(response.url()).searchParams.has('cursor'),
      ),
      next.click(),
    ]);
  }
  throw new Error(`Order row ${orderNumber} was not found in pagination.`);
}

test('manager can filter the current order page and open operational detail', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const context = await newContext();
    const page = await context.newPage();
    await login(page, fixture.users.manager.email);
    await page.goto('/admin/operations');

    await expect(
      page.getByRole('heading', { name: /Operations.*Trung tâm vận hành/ }),
    ).toBeVisible();
    await expect(page.getByTestId('operations-metric')).toHaveCount(4);

    await Promise.all([
      page.waitForResponse((response) => {
        if (
          response.status() !== 200 ||
          !response.url().includes('/api/v1/admin/operations/orders')
        )
          return false;
        return (
          new URL(response.url()).searchParams.get('status') ===
          'READY_FOR_INSTALLATION'
        );
      }),
      page
        .getByLabel('Trang thai don hang')
        .selectOption('READY_FOR_INSTALLATION'),
    ]);
    const target = await findOrderRow(
      page,
      fixture.appointments.pending.orderNumber,
    );
    await page
      .getByLabel('Tim don hang tren trang')
      .fill(fixture.appointments.pending.orderNumber);
    await expect(target).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1);

    await target.getByRole('button', { name: 'Chi tiet' }).click();
    const dialog = page.getByRole('dialog', { name: 'Chi tiet don hang' });
    await expect(dialog).toContainText(
      fixture.appointments.pending.orderNumber,
    );
    await expect(dialog).toContainText('Fixture installation product');
    await expect(dialog).toContainText('READY_FOR_INSTALLATION');
    await expect(dialog.getByText('Lịch sử audit')).toBeVisible();
  });
});

test('operations dashboard keeps page-level responsive boundaries', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const context = await newContext();
    const page = await context.newPage();
    await login(page, fixture.users.manager.email);

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/admin/operations');
      await expect(page.getByRole('tab', { name: 'Don hang' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    }
  });
});
