import { expect, test } from '@playwright/test';

test('shows the placeholder home page and health endpoint', async ({
  page,
  request,
}) => {
  await page.goto('/');

  await expect(page).toHaveTitle('247 Home');
  await expect(
    page.getByRole('heading', {
      name: 'Thiết bị nhà thông minh, lắp đặt tận nơi.',
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
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Không tìm thấy trang.' }),
  ).toBeVisible();
});
