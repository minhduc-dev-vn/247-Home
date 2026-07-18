import { expect, test, type Page } from '@playwright/test';

import {
  createCustomerOrdersFixture,
  customerOrdersFixturePassword,
} from '../fixtures/customer-orders';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page
    .locator('input[type="password"]')
    .fill(customerOrdersFixturePassword);
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

test('customer order history loads own orders with shared navigation and pagination', async ({
  page,
}) => {
  const fixture = await createCustomerOrdersFixture();
  try {
    await signIn(page, fixture.owner.email);
    await page.goto('/orders');

    await expect(
      page.getByRole('heading', { name: 'Đơn hàng của tôi' }),
    ).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.getByTestId('customer-order-card')).toHaveCount(6);
    await expect(
      page.getByText(fixture.orders.tracked.orderNumber),
    ).toBeVisible();
    await expect(page.getByText(fixture.productName).first()).toBeVisible();
    await expect(
      page.getByText(fixture.orders.foreign.orderNumber),
    ).toHaveCount(0);

    await page.getByLabel('Trạng thái').selectOption('READY_FOR_INSTALLATION');
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page).toHaveURL(/status=READY_FOR_INSTALLATION/);
    await expect(page.getByTestId('customer-order-card')).toHaveCount(1);
    await expect(
      page.getByText(fixture.orders.tracked.orderNumber),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Xóa bộ lọc' }).click();
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByLabel('Trạng thái')).toHaveValue('');
    await page.getByRole('link', { name: 'Sau' }).click();
    await expect(page).toHaveURL(/cursor=/);
    await expect(page.getByTestId('customer-order-card')).toHaveCount(1);
  } finally {
    await fixture.cleanup();
  }
});

test('customer order detail renders snapshot, lifecycle, payment and installation data', async ({
  page,
}) => {
  const fixture = await createCustomerOrdersFixture();
  try {
    await signIn(page, fixture.owner.email);
    await page.goto(`/orders/${fixture.orders.tracked.id}`);

    await expect(
      page.getByRole('heading', { name: fixture.orders.tracked.orderNumber }),
    ).toBeVisible();
    await expect(page.getByText(fixture.productName)).toBeVisible();
    await expect(page.getByTestId('order-product-item')).toContainText(
      '4.990.000 VND',
    );
    await expect(page.getByTestId('order-status-timeline')).toBeVisible();
    await expect(page.getByTestId('installation-timeline')).toBeVisible();
    await expect(page.getByText('Đang phân công').first()).toBeVisible();
    await expect(
      page.getByText('Thông tin kỹ thuật viên sẽ được cập nhật'),
    ).toBeVisible();
    await expect(page.getByText('Chuyển khoản thủ công')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Xem tiến độ lắp đặt' }),
    ).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});

test('another customer receives not found without order data leakage', async ({
  page,
}) => {
  const fixture = await createCustomerOrdersFixture();
  try {
    await signIn(page, fixture.owner.email);
    const response = await page.request.get(
      `/api/v1/orders/${fixture.orders.foreign.id}`,
    );
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain(
      fixture.orders.foreign.orderNumber,
    );

    await page.goto(`/orders/${fixture.orders.foreign.id}`);
    await expect(
      page.getByRole('heading', { name: 'Không tìm thấy trang.' }),
    ).toBeVisible();
    await expect(
      page.getByText(fixture.orders.foreign.orderNumber),
    ).toHaveCount(0);
    await expect(
      page.getByText('Sản phẩm riêng tư của khách khác'),
    ).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});

test('order history and installation timeline remain usable at mobile width', async ({
  page,
}) => {
  const fixture = await createCustomerOrdersFixture();
  try {
    await page.setViewportSize({ height: 844, width: 390 });
    await signIn(page, fixture.owner.email);
    await page.goto('/orders');
    await expect(page.getByTestId('customer-order-card').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(`/orders/${fixture.orders.tracked.id}`);
    await expect(page.getByTestId('installation-timeline')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await fixture.cleanup();
  }
});
