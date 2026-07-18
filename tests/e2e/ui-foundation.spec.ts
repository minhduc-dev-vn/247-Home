import { expect, test, type Page } from '@playwright/test';

const password = 'LocalDemoOnly-247Home';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/account$/);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test('customer foundation is usable without horizontal overflow on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'Thiết bị chính hãng. Lắp đặt tận nơi. Hỗ trợ sau bán hàng.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Không gian căn hộ với camera, chuông cửa, khóa thông minh và bộ phát Wi-Fi',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Khám phá sản phẩm' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('admin foundation exposes dashboard navigation on desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, 'admin@example.com');
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Tổng quan hệ thống' }),
  ).toBeVisible();
  await expect(
    page.locator('a[href="/admin/operations"]').first(),
  ).toBeVisible();
  await expect(page.locator('a[href="/admin/catalog"]').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('technician foundation keeps job navigation usable on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'technician1@example.com');
  await page.goto('/technician');
  await expect(
    page.getByRole('heading', { name: 'Công việc của tôi' }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Điều hướng kỹ thuật viên' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
