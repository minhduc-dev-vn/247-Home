import { expect, test, type Page } from '@playwright/test';

const customerPassword = 'LocalDemoOnly-247Home';

async function expectCustomerShell(page: Page) {
  const logo = page.getByRole('link', { name: '247 Home - Trang chủ' });
  await expect(logo).toHaveCount(1);
  await expect(logo).toBeVisible();

  const header = page.locator('header').filter({ has: logo });
  await expect(header).toHaveCount(1);
  await expect(
    header.getByRole('navigation', { name: 'Điều hướng chính' }),
  ).toBeVisible();

  await expect(page.locator('footer')).toHaveCount(1);
  await expect(page.locator('footer')).toBeVisible();
}

async function signInAsCustomer(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@example.com');
  await page.getByLabel('Mật khẩu').fill(customerPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test('customer route layout persists across public catalog navigation', async ({
  page,
}) => {
  await page.goto('/');
  await expectCustomerShell(page);

  const originalLogo = await page
    .getByRole('link', { name: '247 Home - Trang chủ' })
    .elementHandle();
  await page.locator('header').getByRole('link', { name: 'Sản phẩm' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expectCustomerShell(page);

  const layoutPersisted = await originalLogo?.evaluate(
    (node) =>
      node === document.querySelector('a[aria-label="247 Home - Trang chủ"]'),
  );
  expect(layoutPersisted).toBe(true);

  const productLink = page.locator('main a[href^="/products/"]').first();
  const productHref = await productLink.getAttribute('href');
  expect(productHref).toMatch(/^\/products\//);
  await productLink.click();
  await expect(page).toHaveURL(new RegExp(`${productHref}$`));
  await expectCustomerShell(page);
});

test('authenticated customer routes share one header, navbar, and footer', async ({
  page,
}) => {
  await signInAsCustomer(page);

  for (const route of ['/account', '/cart', '/checkout', '/orders']) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expectCustomerShell(page);
  }

  const orderLink = page.locator('main a[href^="/orders/"]').first();
  await expect(orderLink).toBeVisible();
  const orderHref = await orderLink.getAttribute('href');
  expect(orderHref).toMatch(/^\/orders\//);

  await orderLink.click();
  await expect(page).toHaveURL(new RegExp(`${orderHref}$`));
  await expectCustomerShell(page);

  const orderId = orderHref?.split('/').at(-1);
  expect(orderId).toBeTruthy();
  await page.goto(`/order-confirmation/${orderId}`);
  await expectCustomerShell(page);
});

test('auth pages remain outside the customer route layout', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(
    page.getByRole('link', { name: '247 Home - Trang chủ' }),
  ).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});
