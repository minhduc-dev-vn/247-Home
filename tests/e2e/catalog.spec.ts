import { expect, test } from '@playwright/test';

test('shows seeded products and checks a supported service area', async ({
  page,
}) => {
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'San pham' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(12);

  await page.getByLabel('Ma tinh thanh').fill('HCM');
  await page.getByLabel('Ma quan huyen').fill('Q1');
  await page.getByRole('button', { name: 'Kiem tra' }).click();
  await expect(page.getByRole('status')).toContainText('Co phuc vu');
});

test('prevents a signed-in customer from viewing the catalog administration page', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer.demo@local.247home.test');
  await page.locator('input[type="password"]').fill('LocalDemoOnly-247Home');
  await page.locator('form button[type="submit"]').click();

  await page.goto('/admin/catalog');
  await expect(
    page.getByRole('heading', { name: 'Quan ly catalog' }),
  ).not.toBeVisible();
});
