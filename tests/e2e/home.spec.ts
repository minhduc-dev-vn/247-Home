import { expect, test } from '@playwright/test';

test('shows the customer storefront and health endpoint', async ({
  page,
  request,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle('247 Home');
  await expect(
    page.getByRole('heading', {
      name: 'Thiết bị chính hãng. Lắp đặt tận nơi. Hỗ trợ sau bán hàng.',
    }),
  ).toBeVisible();

  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['content-security-policy']).toContain(
    "frame-ancestors 'none'",
  );
  await expect(response.json()).resolves.toMatchObject({
    data: { status: 'ok' },
  });
});

test('prevents a signed-in customer from accessing the admin page', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@example.com');
  await page.getByLabel('Mật khẩu').fill('LocalDemoOnly-247Home');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator('a[href="/products"]').first()).toBeVisible();
  await expect(page.locator('a[href="/admin/operations"]')).toHaveCount(0);
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Không tìm thấy trang.' }),
  ).toBeVisible();
});

test('shows server-resolved administration destinations after admin login', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.locator('input[type="password"]').fill('LocalDemoOnly-247Home');
  await page.locator('form button[type="submit"]').click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator('a[href="/admin"]')).toBeVisible();
  await expect(page.locator('a[href="/admin/operations"]')).toBeVisible();
  await expect(page.locator('a[href="/admin/catalog"]')).toBeVisible();
  await expect(page.locator('a[href="/technician"]')).toHaveCount(0);
});
