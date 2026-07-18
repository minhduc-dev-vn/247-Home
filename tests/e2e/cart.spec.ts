import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { hash } from 'bcryptjs';

import { prisma } from '@/shared/db/client';

const customerPassword = 'CartE2EOnly-247Home';

type CartProduct = {
  name: string;
  slug: string;
  variants: Array<{
    availability: 'IN_STOCK' | 'OUT_OF_STOCK';
    id: string;
    servicePackages: Array<{ id: string; name: string }>;
  }>;
};

async function createCustomerFixture() {
  const email = `cart-e2e-${Date.now()}-${crypto.randomUUID()}@example.test`;
  const customerRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'CUSTOMER' },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Cart E2E Customer',
      passwordHash: await hash(customerPassword, 12),
      roles: { create: { roleId: customerRole.id } },
    },
    select: { id: true },
  });

  return {
    email,
    cleanup: async () => {
      await prisma.$transaction(async (tx) => {
        await tx.cartItem.deleteMany({
          where: { cart: { userId: user.id } },
        });
        await tx.cart.deleteMany({ where: { userId: user.id } });
        await tx.user.deleteMany({ where: { id: user.id } });
      });
    },
  };
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
    const detail = (await detailResponse.json()) as { data: CartProduct };
    const variant = detail.data.variants.find(
      (candidate) =>
        candidate.availability === 'IN_STOCK' &&
        candidate.servicePackages.length > 0,
    );
    if (variant) return { product: detail.data, variant };
  }
  throw new Error('Seed data has no installable in-stock product.');
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').fill(customerPassword);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/account$/);
}

async function clearCart(page: Page) {
  await page.evaluate(async () => {
    const response = await fetch('/api/v1/cart');
    if (!response.ok) return;
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

async function addCartItem(
  page: Page,
  input: { productVariantId: string; servicePackageId: string | null },
) {
  const result = await page.evaluate(async (cartInput) => {
    const response = await fetch('/api/v1/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cartInput, quantity: 1 }),
    });
    return { status: response.status };
  }, input);
  expect(result.status).toBe(201);
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

test('updates and removes a real cart item with its installation package', async ({
  page,
  request,
}) => {
  const customer = await createCustomerFixture();
  const { product, variant } = await getInstallableProduct(request);
  const servicePackage = variant.servicePackages[0];

  try {
    await signIn(page, customer.email);
    await addCartItem(page, {
      productVariantId: variant.id,
      servicePackageId: servicePackage.id,
    });
    await page.goto('/cart');

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Giỏ hàng', exact: true }),
    ).toBeVisible();
    const item = page.getByTestId('cart-item');
    await expect(item).toContainText(product.name);
    await expect(item).toContainText(servicePackage.name);
    await expect(page.getByTestId('cart-summary')).toBeVisible();

    await item.getByRole('button', { name: /Tăng số lượng/ }).click();
    await expect(item.getByTestId('cart-item-quantity')).toHaveText('2');

    await item.getByRole('button', { name: 'Xóa' }).click();
    await expect(
      page.getByRole('heading', {
        name: 'Giỏ hàng của bạn đang trống',
      }),
    ).toBeVisible();
  } finally {
    await clearCart(page);
    await customer.cleanup();
  }
});

test('shows the empty cart experience for an authenticated customer', async ({
  page,
}) => {
  const customer = await createCustomerFixture();

  try {
    await signIn(page, customer.email);
    await page.goto('/cart');

    await expect(
      page.getByRole('heading', {
        name: 'Giỏ hàng của bạn đang trống',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Khám phá sản phẩm' }),
    ).toBeVisible();
  } finally {
    await clearCart(page);
    await customer.cleanup();
  }
});

test('stacks the summary below cart items without overflow on smaller screens', async ({
  page,
  request,
}) => {
  const customer = await createCustomerFixture();
  const { variant } = await getInstallableProduct(request);

  try {
    await signIn(page, customer.email);
    await addCartItem(page, {
      productVariantId: variant.id,
      servicePackageId: variant.servicePackages[0].id,
    });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/cart', { waitUntil: 'domcontentloaded' });
      const item = page.getByTestId('cart-item');
      const summary = page.getByTestId('cart-summary');
      await expect(item).toBeVisible();
      await expect(summary).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const itemBox = await item.boundingBox();
      const summaryBox = await summary.boundingBox();
      expect(itemBox).not.toBeNull();
      expect(summaryBox).not.toBeNull();
      if (viewport.width < 1024) {
        expect(summaryBox?.y ?? 0).toBeGreaterThan(itemBox?.y ?? 0);
      } else {
        expect(summaryBox?.x ?? 0).toBeGreaterThan(itemBox?.x ?? 0);
      }
    }
  } finally {
    await clearCart(page);
    await customer.cleanup();
  }
});
