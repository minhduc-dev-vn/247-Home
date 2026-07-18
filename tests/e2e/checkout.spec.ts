import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { hash } from 'bcryptjs';

import { prisma } from '@/shared/db/client';

const customerPassword = 'CheckoutE2EOnly-247Home';

type ProductDetail = {
  name: string;
  variants: Array<{
    availability: 'IN_STOCK' | 'OUT_OF_STOCK';
    id: string;
    servicePackages: Array<{ id: string; name: string }>;
  }>;
};

async function createCheckoutFixture({ withSlot = true } = {}) {
  const namespace = `${Date.now()}-${crypto.randomUUID()}`;
  const email = `checkout-e2e-${namespace}@example.test`;
  const [role, area] = await Promise.all([
    prisma.role.findUniqueOrThrow({
      where: { code: 'CUSTOMER' },
      select: { id: true },
    }),
    prisma.serviceArea.findUniqueOrThrow({
      where: { code: 'HCM-Q1' },
      select: { id: true },
    }),
  ]);
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Checkout E2E Customer',
      passwordHash: await hash(customerPassword, 12),
      roles: { create: { roleId: role.id } },
    },
    select: { id: true },
  });
  const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  startsAt.setMinutes(0, 0, 0);
  const slot = withSlot
    ? await prisma.installationSlot.create({
        data: {
          serviceAreaId: area.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
          capacity: 1,
        },
        select: { id: true },
      })
    : null;

  return {
    email,
    serviceAreaId: area.id,
    slotId: slot?.id ?? null,
    userId: user.id,
    cleanup: async () => {
      await prisma.$transaction(async (tx) => {
        const orders = await tx.order.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            items: {
              select: { id: true, productVariantId: true, quantity: true },
            },
          },
        });
        const orderIds = orders.map(({ id }) => id);
        const orderItemIds = orders.flatMap(({ items }) =>
          items.map(({ id }) => id),
        );
        const reservedByVariant = new Map<string, number>();
        for (const order of orders)
          for (const item of order.items)
            reservedByVariant.set(
              item.productVariantId,
              (reservedByVariant.get(item.productVariantId) ?? 0) +
                item.quantity,
            );

        await tx.checkoutAttempt.deleteMany({ where: { userId: user.id } });
        await tx.cart.updateMany({
          where: { userId: user.id },
          data: { checkedOutOrderId: null },
        });
        await tx.installationAppointment.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await tx.payment.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await tx.inventoryAllocation.deleteMany({
          where: { orderItemId: { in: orderItemIds } },
        });
        await tx.orderItem.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
        for (const [productVariantId, quantity] of reservedByVariant)
          await tx.inventory.update({
            where: { productVariantId },
            data: { reserved: { decrement: quantity } },
          });
        await tx.cartItem.deleteMany({
          where: { cart: { userId: user.id } },
        });
        await tx.cart.deleteMany({ where: { userId: user.id } });
        await tx.address.deleteMany({ where: { userId: user.id } });
        if (slot)
          await tx.installationSlot.deleteMany({ where: { id: slot.id } });
        await tx.user.deleteMany({ where: { id: user.id } });
      });
    },
  };
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').fill(customerPassword);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/account$/);
}

async function getInstallableProduct(request: APIRequestContext) {
  const response = await request.get('/api/v1/products?limit=12');
  const list = (await response.json()) as {
    data: { items: Array<{ slug: string }> };
  };
  for (const product of list.data.items) {
    const detailResponse = await request.get(
      `/api/v1/products/${product.slug}`,
    );
    const detail = (await detailResponse.json()) as { data: ProductDetail };
    const variant = detail.data.variants.find(
      (candidate) =>
        candidate.availability === 'IN_STOCK' &&
        candidate.servicePackages.length > 0,
    );
    if (variant) return { product: detail.data, variant };
  }
  throw new Error('Seed data has no installable in-stock product.');
}

async function addCartItem(
  page: Page,
  input: { productVariantId: string; servicePackageId?: string },
) {
  const result = await page.evaluate(async (body) => {
    const response = await fetch('/api/v1/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, quantity: 1 }),
    });
    const payload = (await response.json()) as { data?: { id: string } };
    return { cartId: payload.data?.id, status: response.status };
  }, input);
  expect(result.status).toBe(201);
  return result.cartId;
}

async function fillAddress(page: Page, supported: boolean) {
  await page.getByLabel('Số điện thoại').fill('0900000000');
  await page.getByLabel('Địa chỉ chi tiết').fill('1 Test Street');
  await page.getByLabel('Ghi chú giao nhận (không bắt buộc)').fill('Tang 2');
  await page.getByLabel('Phường/xã').fill('Ben Nghe');
  await page
    .getByLabel('Quận/huyện', { exact: true })
    .fill(supported ? 'Quan 1' : 'No Area');
  await page
    .getByLabel('Mã quận/huyện', { exact: true })
    .fill(supported ? 'Q1' : 'NOAREA');
  await page
    .getByLabel('Tỉnh/thành', { exact: true })
    .fill(supported ? 'Ho Chi Minh' : 'No Area');
  await page
    .getByLabel('Mã tỉnh/thành', { exact: true })
    .fill(supported ? 'HCM' : 'NOAREA');
  await page.getByRole('button', { name: 'Lưu và kiểm tra khu vực' }).click();
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

test.describe('checkout', () => {
  test('requires login before showing checkout', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('creates an installation order through the UI, clears the active cart, and denies another customer', async ({
    page,
    request,
  }) => {
    const owner = await createCheckoutFixture();
    const intruder = await createCheckoutFixture({ withSlot: false });
    try {
      const { product, variant } = await getInstallableProduct(request);
      await signIn(page, owner.email);
      await addCartItem(page, {
        productVariantId: variant.id,
        servicePackageId: variant.servicePackages[0].id,
      });

      for (const viewport of [
        { width: 390, height: 844 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto('/checkout');
        const customerHeading = page.getByRole('heading', {
          name: 'Thông tin khách hàng',
        });
        const summary = page.getByTestId('checkout-summary');
        await expect(customerHeading).toBeVisible();
        await expect(summary).toBeVisible();
        await expectNoHorizontalOverflow(page);
        const customerBox = await customerHeading.boundingBox();
        const summaryBox = await summary.boundingBox();
        expect(customerBox).not.toBeNull();
        expect(summaryBox).not.toBeNull();
        if (viewport.width < 1024)
          expect(summaryBox?.y ?? 0).toBeGreaterThan(customerBox?.y ?? 0);
        else expect(summaryBox?.x ?? 0).toBeGreaterThan(customerBox?.x ?? 0);
      }

      await expect(
        page.getByRole('heading', { name: 'Hoàn tất đơn hàng' }),
      ).toBeVisible();
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByTestId('checkout-summary')).toContainText(
        product.name,
      );
      await expect(page.getByTestId('checkout-summary')).toContainText(
        variant.servicePackages[0].name,
      );
      await fillAddress(page, true);
      await expect(page.getByText('Khu vực được hỗ trợ')).toBeVisible();

      const slot = page.getByTestId(`installation-slot-${owner.slotId}`);
      await expect(slot).toBeVisible();
      await slot.getByRole('radio').check();
      await expect(page.getByTestId('checkout-quote')).toBeVisible();
      const confirm = page.getByTestId('confirm-order');
      await expect(confirm).toBeEnabled();
      await confirm.click();
      await expect(page).toHaveURL(/\/order-confirmation\/[^/]+$/);
      await expect(page.getByText('Đặt hàng thành công')).toBeVisible();
      await expect(page.getByText(product.name)).toBeVisible();
      await expect(page.getByText('Thông tin lắp đặt')).toBeVisible();

      const orderId = new URL(page.url()).pathname.split('/').at(-1);
      expect(orderId).toBeTruthy();
      const cart = await page.evaluate(async () => {
        const response = await fetch('/api/v1/cart');
        const payload = (await response.json()) as {
          data: { items: unknown[] };
        };
        return payload.data;
      });
      expect(cart.items).toHaveLength(0);

      await page.context().clearCookies();
      await signIn(page, intruder.email);
      const response = await page.request.get(`/api/v1/orders/${orderId}`);
      expect(response.status()).toBe(404);
      await page.goto(`/order-confirmation/${orderId}`);
      await expect(
        page.getByRole('heading', { name: 'Không tìm thấy trang.' }),
      ).toBeVisible();
    } finally {
      await owner.cleanup();
      await intruder.cleanup();
    }
  });

  test('validates the address and blocks an unsupported installation area', async ({
    page,
    request,
  }) => {
    const fixture = await createCheckoutFixture({ withSlot: false });
    try {
      const { variant } = await getInstallableProduct(request);
      await signIn(page, fixture.email);
      await addCartItem(page, {
        productVariantId: variant.id,
        servicePackageId: variant.servicePackages[0].id,
      });
      await page.goto('/checkout');

      await page
        .getByRole('button', { name: 'Lưu và kiểm tra khu vực' })
        .click();
      await expect(page.getByLabel('Số điện thoại')).toBeFocused();
      await fillAddress(page, false);
      await expect(page.getByText('Khu vực chưa được hỗ trợ')).toBeVisible();
      await expect(page.getByTestId('confirm-order')).toBeDisabled();
    } finally {
      await fixture.cleanup();
    }
  });

  test('returns the authoritative out-of-stock conflict without creating an order', async ({
    page,
    request,
  }) => {
    const fixture = await createCheckoutFixture({ withSlot: false });
    try {
      await signIn(page, fixture.email);
      const listResponse = await request.get('/api/v1/products?limit=12');
      const list = (await listResponse.json()) as {
        data: {
          items: Array<{
            availability: 'IN_STOCK' | 'OUT_OF_STOCK';
            slug: string;
          }>;
        };
      };
      const product = list.data.items.find(
        ({ availability }) => availability === 'OUT_OF_STOCK',
      );
      expect(product).toBeDefined();
      const detailResponse = await request.get(
        `/api/v1/products/${product?.slug}`,
      );
      const detail = (await detailResponse.json()) as {
        data: { variants: Array<{ id: string }> };
      };
      const cartId = await addCartItem(page, {
        productVariantId: detail.data.variants[0].id,
      });
      const address = await page.evaluate(async () => {
        const response = await fetch('/api/v1/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientName: 'Checkout E2E Customer',
            phone: '0900000000',
            line1: '2 Test Street',
            wardName: 'Ben Nghe',
            districtCode: 'Q1',
            districtName: 'Quan 1',
            provinceCode: 'HCM',
            provinceName: 'Ho Chi Minh',
          }),
        });
        const payload = (await response.json()) as { data?: { id: string } };
        return { payload, status: response.status };
      });
      expect(address.status).toBe(201);
      expect(address.payload.data?.id).toBeTruthy();
      const checkout = await page.evaluate(
        async (input) => {
          const response = await fetch('/api/v1/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': input.idempotencyKey,
            },
            body: JSON.stringify({
              cartId: input.cartId,
              addressId: input.addressId,
              paymentMethod: 'BANK_TRANSFER',
            }),
          });
          return { payload: await response.json(), status: response.status };
        },
        {
          addressId: address.payload.data?.id ?? '',
          cartId: cartId ?? '',
          idempotencyKey: `checkout-stock-${crypto.randomUUID()}`,
        },
      );
      expect(checkout.status).toBe(409);
      expect(checkout.payload).toMatchObject({
        error: { code: 'INVENTORY_INSUFFICIENT' },
      });
      await expect(
        prisma.order.count({ where: { userId: fixture.userId } }),
      ).resolves.toBe(0);
    } finally {
      await fixture.cleanup();
    }
  });
});
