import { expect, test, type Page } from '@playwright/test';
import {
  AppointmentStatus,
  InventoryDisposition,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';

import {
  createCustomerOrdersFixture,
  customerOrdersFixturePassword,
} from '../fixtures/customer-orders';
import { prisma } from '@/shared/db/client';

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

    await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
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

test('customer cancels an eligible pending order and releases its reservation and appointment slot', async ({
  page,
}) => {
  const fixture = await createCustomerOrdersFixture();
  try {
    await signIn(page, fixture.owner.email);
    await page.goto(`/orders/${fixture.orders.cancellable.id}`);

    await page.getByRole('button', { name: 'Hủy đơn hàng' }).click();
    await page
      .getByLabel('Lý do hủy đơn')
      .fill('Không còn nhu cầu lắp đặt tại thời điểm này.');
    await page.getByRole('button', { name: 'Xác nhận hủy đơn' }).click();

    await expect(page.getByText('Đã hủy').first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Hủy đơn hàng' }),
    ).toHaveCount(0);

    await expect
      .poll(async () => {
        const [order, inventory, allocation, appointment, auditCount] =
          await Promise.all([
            prisma.order.findUniqueOrThrow({
              where: { id: fixture.orders.cancellable.id },
              select: { status: true, inventoryStatus: true, version: true },
            }),
            prisma.inventory.findUniqueOrThrow({
              where: { productVariantId: fixture.variantId },
              select: { reserved: true },
            }),
            prisma.inventoryAllocation.findUniqueOrThrow({
              where: { orderItemId: fixture.orders.cancellable.items[0].id },
              select: { status: true, releasedAt: true },
            }),
            prisma.installationAppointment.findUniqueOrThrow({
              where: { orderId: fixture.orders.cancellable.id },
              select: {
                status: true,
                capacityReleasedAt: true,
                slot: { select: { bookedCount: true } },
                order: { select: { payment: { select: { status: true } } } },
              },
            }),
            prisma.auditLog.count({
              where: {
                action: 'order.cancel',
                targetId: fixture.orders.cancellable.id,
              },
            }),
          ]);
        return {
          allocationReleased: allocation.releasedAt instanceof Date,
          allocationStatus: allocation.status,
          appointmentReleased: appointment.capacityReleasedAt instanceof Date,
          appointmentStatus: appointment.status,
          auditCount,
          inventoryReserved: inventory.reserved,
          orderStatus: order.status,
          orderVersion: order.version,
          paymentStatus: appointment.order.payment?.status,
          slotBookedCount: appointment.slot.bookedCount,
        };
      })
      .toEqual({
        allocationReleased: true,
        allocationStatus: InventoryDisposition.RELEASED,
        appointmentReleased: true,
        appointmentStatus: AppointmentStatus.CANCELLED,
        auditCount: 1,
        inventoryReserved: 0,
        orderStatus: OrderStatus.CANCELLED,
        orderVersion: 2,
        paymentStatus: PaymentStatus.CANCELLED,
        slotBookedCount: 0,
      });
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

    const cancellation = await page.request.post(
      `/api/v1/orders/${fixture.orders.foreign.id}/actions/cancel`,
      {
        data: {
          expectedVersion: 1,
          reason: 'Attempt to access another customer order',
        },
        headers: {
          'Content-Type': 'application/json',
          Origin: new URL(page.url()).origin,
        },
      },
    );
    expect(cancellation.status()).toBe(404);
    expect(await cancellation.text()).not.toContain(
      fixture.orders.foreign.orderNumber,
    );

    const adminMutation = await page.request.post(
      `/api/v1/admin/orders/${fixture.orders.cancellable.id}/actions`,
      {
        data: {
          action: 'cancel',
          expectedVersion: 1,
          reason: 'Customer must not access the operations endpoint',
        },
        headers: {
          'Content-Type': 'application/json',
          Origin: new URL(page.url()).origin,
        },
      },
    );
    expect(adminMutation.status()).toBe(403);
    await expect(
      prisma.order.findUniqueOrThrow({
        where: { id: fixture.orders.cancellable.id },
        select: { status: true, version: true },
      }),
    ).resolves.toEqual({
      status: OrderStatus.PENDING_CONFIRMATION,
      version: 1,
    });

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
