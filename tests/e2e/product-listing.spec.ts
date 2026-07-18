import { expect, test, type Page } from '@playwright/test';

type CatalogResponse = {
  data: {
    items: Array<{
      category: string;
      minPriceVnd: string | null;
      name: string;
      slug: string;
    }>;
  };
};

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test('renders real catalog data and opens a product detail', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/v1/products?limit=12');
  expect(response.ok()).toBe(true);
  const catalog = (await response.json()) as CatalogResponse;
  expect(catalog.data.items.length).toBeGreaterThan(0);

  await page.goto('/products');
  await expect(
    page.getByRole('heading', { name: 'Thiết bị gia dụng chính hãng' }),
  ).toBeVisible();
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();

  const cards = page.getByTestId('product-card');
  await expect(cards).toHaveCount(catalog.data.items.length);
  for (const product of catalog.data.items) {
    await expect(
      cards.getByRole('link', { name: product.name, exact: true }),
    ).toBeVisible();
  }

  const firstProductImage = cards.first().locator('img');
  await expect(firstProductImage).toBeVisible();
  await expect
    .poll(async () =>
      decodeURIComponent((await firstProductImage.getAttribute('src')) ?? ''),
    )
    .toContain('/assets/images/products/');
  await expect
    .poll(() =>
      firstProductImage.evaluate(
        (image) =>
          (image as HTMLImageElement).complete &&
          (image as HTMLImageElement).naturalWidth > 0,
      ),
    )
    .toBe(true);

  const first = catalog.data.items[0];
  await cards
    .first()
    .getByRole('link', { name: `Xem chi tiết ${first.name}` })
    .click();
  await expect(page).toHaveURL(new RegExp(`/products/${first.slug}$`));
});

test('filters by a real catalog category and supports an empty result', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/v1/products?limit=1');
  const catalog = (await response.json()) as CatalogResponse;
  const first = catalog.data.items[0];

  await page.goto(`/products?category=${first.category}`);
  await expect(page.locator('a[aria-current="page"]')).not.toHaveText('Tất cả');
  await expect(page.getByTestId('product-card').first()).toBeVisible();

  await page.goto('/products?q=khong-ton-tai-247-home-e2e');
  await expect(
    page.getByRole('heading', { name: 'Không tìm thấy sản phẩm phù hợp' }),
  ).toBeVisible();
  await expect(page.getByTestId('product-card')).toHaveCount(0);
});

test('keeps filters and cards responsive at supported widths', async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await expectNoHorizontalOverflow(page);
    await expect(page.getByTestId('product-card').first()).toBeVisible();

    if (viewport.width >= 1024) {
      await expect(page.getByTestId('desktop-product-filters')).toBeVisible();
      await expect(page.getByTestId('mobile-product-filters')).toBeHidden();
    } else {
      await expect(page.getByTestId('mobile-product-filters')).toBeVisible();
      await expect(page.getByTestId('desktop-product-filters')).toBeHidden();
      await page
        .getByTestId('mobile-product-filters')
        .getByRole('button', { name: 'Bộ lọc sản phẩm' })
        .click();
      await expect(
        page.getByTestId('mobile-product-filter-drawer'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Đóng bộ lọc' }).click();
    }
  }
});
