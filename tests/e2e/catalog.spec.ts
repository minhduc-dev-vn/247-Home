import { expect, test } from '@playwright/test';

test('shows seeded products and checks a supported service area', async ({
  page,
}) => {
  await page.goto('/products');
  await expect(
    page.getByRole('heading', { name: 'Thiết bị gia dụng chính hãng' }),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(12);

  const areaChecker = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Kiểm tra khu vực lắp đặt' }),
  });
  await areaChecker.getByLabel('Mã tỉnh/thành').fill('HCM');
  await areaChecker.getByLabel('Mã quận/huyện').fill('Q1');
  await areaChecker.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(areaChecker.getByRole('status')).toContainText('Có phục vụ');
});

test('prevents a signed-in customer from viewing the catalog administration page', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@example.com');
  await page.locator('input[type="password"]').fill('LocalDemoOnly-247Home');
  await page.locator('form button[type="submit"]').click();

  await page.goto('/admin/catalog');
  await expect(
    page.getByRole('heading', { name: 'Quan ly catalog' }),
  ).not.toBeVisible();
});
