import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { hash } from 'bcryptjs';

import { prisma } from '@/shared/db/client';
import { formatVnd } from '@/shared/money/format-vnd';

const customerPassword = 'ProductDetailE2EOnly-247Home';

type ProductDetail = {
  category: string;
  images: Array<{ altText: string; id: string }>;
  name: string;
  slug: string;
  variants: Array<{
    availability: 'IN_STOCK' | 'OUT_OF_STOCK';
    id: string;
    name: string;
    priceVnd: string;
    servicePackages: Array<{
      id: string;
      name: string;
      priceVnd: string;
    }>;
  }>;
};

async function getInstallableProduct(request: APIRequestContext) {
  const listResponse = await request.get('/api/v1/products?limit=12');
  expect(listResponse.ok()).toBe(true);
  const list = (await listResponse.json()) as {
    data: { items: Array<{ slug: string }> };
  };
  for (const item of list.data.items) {
    const detailResponse = await request.get(`/api/v1/products/${item.slug}`);
    const payload = (await detailResponse.json()) as { data: ProductDetail };
    const variant = payload.data.variants.find(
      (candidate) =>
        candidate.availability === 'IN_STOCK' &&
        candidate.servicePackages.length > 0,
    );
    if (variant) return { product: payload.data, variant };
  }
  throw new Error('Seed data has no installable in-stock product.');
}

async function createCustomerFixture() {
  const email = `product-detail-e2e-${Date.now()}-${crypto.randomUUID()}@example.test`;
  const customerRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'CUSTOMER' },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Product Detail E2E Customer',
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

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test('renders real product, installation packages and service-area result', async ({
  page,
  request,
}) => {
  const { product, variant } = await getInstallableProduct(request);
  const servicePackage = variant.servicePackages[0];

  await page.goto(`/products/${product.slug}`);
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.getByRole('heading', { name: product.name })).toBeVisible();
  await expect(
    page.locator('main img, main [role="img"]').first(),
  ).toBeVisible();
  const primaryImage = page.locator('main img').first();
  await expect
    .poll(async () =>
      decodeURIComponent((await primaryImage.getAttribute('src')) ?? ''),
    )
    .toContain(`/assets/images/products/${product.slug}.png`);
  await expect(page.locator('main button img')).toHaveCount(4);
  await expect(
    page.getByText(formatVnd(variant.priceVnd), { exact: true }).first(),
  ).toBeVisible();
  const installationSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Lắp đặt cùng 247 Home' }),
  });
  await expect(installationSection).toBeVisible();
  await expect(
    installationSection.getByRole('heading', { name: servicePackage.name }),
  ).toBeVisible();

  const areaChecker = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Kiểm tra khu vực lắp đặt' }),
  });
  await areaChecker.getByLabel('Mã tỉnh/thành').fill('HCM');
  await areaChecker.getByLabel('Mã quận/huyện').fill('Q1');
  await areaChecker.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(areaChecker.getByRole('status')).toContainText('Có phục vụ');
});

test('adds the selected real variant and installation package to the cart', async ({
  page,
  request,
}) => {
  const { product, variant } = await getInstallableProduct(request);
  const servicePackage = variant.servicePackages[0];
  const customer = await createCustomerFixture();

  try {
    await signIn(page, customer.email);
    await page.goto(`/products/${product.slug}`);
    await page.getByLabel('Biến thể').selectOption(variant.id);
    await page.getByLabel('Gói lắp đặt').selectOption(servicePackage.id);
    await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).click();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(
      page.getByText(new RegExp(product.name)).first(),
    ).toBeVisible();
    await expect(page.getByText(servicePackage.name).first()).toBeVisible();
  } finally {
    await clearCart(page);
    await customer.cleanup();
  }
});

test('keeps the gallery and purchase flow responsive at supported widths', async ({
  page,
  request,
}) => {
  const { product } = await getInstallableProduct(request);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/products/${product.slug}`, {
      waitUntil: 'domcontentloaded',
    });
    const visual = page.locator('main img, main [role="img"]').first();
    const heading = page.getByRole('heading', { name: product.name });
    await expect(visual).toBeVisible();
    await expect
      .poll(async () =>
        decodeURIComponent((await visual.getAttribute('src')) ?? ''),
      )
      .toContain('/assets/images/products/');
    await expect(heading).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const visualBox = await visual.boundingBox();
    const headingBox = await heading.boundingBox();
    expect(visualBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    if (viewport.width < 1024) {
      expect(
        (visualBox?.y ?? 0) + (visualBox?.height ?? 0),
      ).toBeLessThanOrEqual(headingBox?.y ?? 0);
    } else {
      expect(visualBox?.x ?? 0).toBeLessThan(headingBox?.x ?? 0);
    }
  }
});
