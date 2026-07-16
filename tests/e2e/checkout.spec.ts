import { expect, test } from '@playwright/test';

import { prisma } from '@/shared/db/client';

const customerEmail = 'customer@example.com';
const customerPassword = 'LocalDemoOnly-247Home';

type CheckoutTestFixture = {
  serviceAreaId: string;
  slotId: string;
  cleanup: (input: {
    addressId?: string;
    cartId?: string;
    orderId?: string;
  }) => Promise<void>;
};

async function createCheckoutTestFixture(): Promise<CheckoutTestFixture> {
  const area = await prisma.serviceArea.findUniqueOrThrow({
    where: { code: 'HCM-Q1' },
    select: { id: true },
  });
  const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  const slot = await prisma.installationSlot.create({
    data: {
      serviceAreaId: area.id,
      startsAt,
      endsAt,
      capacity: 1,
    },
    select: { id: true },
  });

  return {
    serviceAreaId: area.id,
    slotId: slot.id,
    cleanup: async ({ addressId, cartId, orderId }) => {
      await prisma.$transaction(async (tx) => {
        const order = orderId
          ? await tx.order.findUnique({
              where: { id: orderId },
              select: {
                items: {
                  select: { id: true, productVariantId: true, quantity: true },
                },
              },
            })
          : null;
        if (order) {
          const quantities = new Map<string, number>();
          for (const item of order.items)
            quantities.set(
              item.productVariantId,
              (quantities.get(item.productVariantId) ?? 0) + item.quantity,
            );
          await tx.checkoutAttempt.deleteMany({ where: { orderId } });
          await tx.cart.updateMany({
            where: { checkedOutOrderId: orderId },
            data: { checkedOutOrderId: null },
          });
          await tx.installationAppointment.deleteMany({ where: { orderId } });
          await tx.payment.deleteMany({ where: { orderId } });
          await tx.inventoryAllocation.deleteMany({
            where: {
              orderItemId: {
                in: order.items.map(({ id }) => id),
              },
            },
          });
          await tx.orderItem.deleteMany({ where: { orderId } });
          await tx.order.deleteMany({ where: { id: orderId } });
          for (const [productVariantId, quantity] of quantities)
            await tx.inventory.update({
              where: { productVariantId },
              data: { reserved: { decrement: quantity } },
            });
        }
        if (cartId) {
          await tx.cartItem.deleteMany({ where: { cartId } });
          await tx.cart.deleteMany({ where: { id: cartId } });
        }
        if (addressId)
          await tx.address.deleteMany({ where: { id: addressId } });
        await tx.installationSlot.deleteMany({ where: { id: slot.id } });
      });
    },
  };
}

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(customerEmail);
  await page.locator('input[type="password"]').fill(customerPassword);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/account$/);
  await page.evaluate(async () => {
    const response = await fetch('/api/v1/cart');
    const payload = (await response.json()) as {
      data: { items: Array<{ id: string }> };
    };
    await Promise.all(
      payload.data.items.map((item) =>
        fetch(`/api/v1/cart/items/${item.id}`, { method: 'DELETE' }),
      ),
    );
  });
}

test.describe('checkout', () => {
  test('customer can complete an installation order', async ({ page }) => {
    const fixture = await createCheckoutTestFixture();
    let cartId: string | undefined;
    let addressId: string | undefined;
    let orderId: string | undefined;
    try {
      await signIn(page);

      const detail = await page.evaluate(async () => {
        const response = await fetch('/api/v1/products?limit=12');
        const payload = (await response.json()) as {
          data: { items: Array<{ slug: string }> };
        };
        for (const product of payload.data.items) {
          const detailResponse = await fetch(
            `/api/v1/products/${product.slug}`,
          );
          const detailPayload = (await detailResponse.json()) as {
            data: {
              variants: Array<{
                id: string;
                availability: string;
                servicePackages: Array<{ id: string }>;
              }>;
            };
          };
          const variant = detailPayload.data.variants.find(
            (item) =>
              item.availability === 'IN_STOCK' &&
              item.servicePackages.length > 0,
          );
          if (variant) {
            return {
              productVariantId: variant.id,
              servicePackageId: variant.servicePackages[0].id,
            };
          }
        }
        return null;
      });

      expect(detail).toBeDefined();

      const cart = await page.evaluate(
        async (input) => {
          const response = await fetch('/api/v1/cart/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          });
          const payload = (await response.json()) as { data: { id: string } };
          return { status: response.status, payload };
        },
        {
          productVariantId: detail?.productVariantId ?? '',
          servicePackageId: detail?.servicePackageId ?? '',
          quantity: 1,
        },
      );

      expect(cart.status).toBe(201);
      cartId = cart.payload.data.id;

      const address = await page.evaluate(async () => {
        const response = await fetch('/api/v1/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientName: 'E2E Customer',
            phone: '0900000000',
            line1: '1 Test Street',
            wardName: 'Ben Nghe',
            districtCode: 'Q1',
            districtName: 'Quan 1',
            provinceCode: 'HCM',
            provinceName: 'Ho Chi Minh',
          }),
        });
        const payload = (await response.json()) as {
          data: { id: string; serviceAreaId: string };
        };
        return { status: response.status, payload };
      });

      expect(address.status).toBe(201);
      addressId = address.payload.data.id;
      expect(address.payload.data.serviceAreaId).toBe(fixture.serviceAreaId);

      const slot = await page.evaluate(
        async ({ serviceAreaId, slotId }) => {
          const from = new Date();
          from.setDate(from.getDate() + 1);
          const to = new Date();
          to.setDate(to.getDate() + 5);
          const params = new URLSearchParams({
            serviceAreaId,
            fromDate: from.toISOString().slice(0, 10),
            toDate: to.toISOString().slice(0, 10),
          });
          const response = await fetch(`/api/v1/installation-slots?${params}`);
          const payload = (await response.json()) as {
            data: {
              items: Array<{ id: string; available: number }>;
              nextCursor: string | null;
            };
          };
          return payload.data.items.find(
            (item) => item.id === slotId && item.available > 0,
          );
        },
        {
          serviceAreaId: address.payload.data.serviceAreaId,
          slotId: fixture.slotId,
        },
      );

      if (!slot)
        throw new Error('No installation slot is available for E2E checkout.');
      const idempotencyKey = `checkout-e2e-happy-${Date.now()}`;

      const order = await page.evaluate(
        async ({ idempotencyKey, ...input }) => {
          const response = await fetch('/api/v1/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(input),
          });
          const payload = (await response.json()) as { data: { id: string } };
          return { status: response.status, payload };
        },
        {
          cartId: cart.payload.data.id,
          addressId: address.payload.data.id,
          slotId: slot.id,
          paymentMethod: 'COD',
          idempotencyKey,
        },
      );

      expect(order.status, JSON.stringify(order.payload)).toBe(201);
      orderId = order.payload.data.id;
      await page.goto(`/order-confirmation/${order.payload.data.id}`);
      await expect(page.getByText('Dat hang thanh cong')).toBeVisible();
    } finally {
      await fixture.cleanup({ addressId, cartId, orderId });
    }
  });

  test('customer sees an out-of-stock error at checkout', async ({ page }) => {
    await signIn(page);

    const product = await page.evaluate(async () => {
      const response = await fetch('/api/v1/products?limit=12');
      const payload = (await response.json()) as {
        data: { items: Array<{ slug: string; availability: string }> };
      };
      return payload.data.items.find(
        (item) => item.availability === 'OUT_OF_STOCK',
      );
    });

    expect(product).toBeDefined();

    const detail = await page.evaluate(async (slug) => {
      const response = await fetch(`/api/v1/products/${slug}`);
      const payload = (await response.json()) as {
        data: { variants: Array<{ id: string }> };
      };
      return payload.data;
    }, product?.slug ?? '');

    const cart = await page.evaluate(async (variantId) => {
      const response = await fetch('/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productVariantId: variantId, quantity: 1 }),
      });
      const payload = (await response.json()) as { data: { id: string } };
      return { status: response.status, payload };
    }, detail.variants[0].id);

    expect(cart.status).toBe(201);

    const address = await page.evaluate(async () => {
      const response = await fetch('/api/v1/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: 'E2E Customer',
          phone: '0900000000',
          line1: '2 Test Street',
          wardName: 'Ben Nghe',
          districtCode: 'Q1',
          districtName: 'Quan 1',
          provinceCode: 'HCM',
          provinceName: 'Ho Chi Minh',
        }),
      });
      const payload = (await response.json()) as { data: { id: string } };
      return { status: response.status, payload };
    });

    const checkout = await page.evaluate(
      async (input) => {
        const response = await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'checkout-e2e-stock-0001',
          },
          body: JSON.stringify(input),
        });
        const payload = (await response.json()) as {
          error: { code: string };
        };
        return { status: response.status, payload };
      },
      {
        cartId: cart.payload.data.id,
        addressId: address.payload.data.id,
        paymentMethod: 'BANK_TRANSFER',
      },
    );

    expect(checkout.status).toBe(409);
    expect(checkout.payload.error.code).toBe('INVENTORY_INSUFFICIENT');
  });
});
