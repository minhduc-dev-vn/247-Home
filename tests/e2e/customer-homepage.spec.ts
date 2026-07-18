import { expect, test } from '@playwright/test';

type CatalogResponse = {
  data: {
    items: Array<{
      name: string;
      slug: string;
    }>;
  };
};

async function expectNoHorizontalOverflow(
  page: import('@playwright/test').Page,
) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test('loads the storefront with real featured catalog products', async ({
  page,
  request,
}) => {
  const catalogResponse = await request.get('/api/v1/products?limit=4');
  expect(catalogResponse.ok()).toBe(true);
  const catalog = (await catalogResponse.json()) as CatalogResponse;
  expect(catalog.data.items.length).toBeGreaterThan(0);

  await page.goto('/');

  await expect(page).toHaveTitle('247 Home');
  await expect(
    page.getByRole('heading', {
      name: 'Thiết bị chính hãng. Lắp đặt tận nơi. Hỗ trợ sau bán hàng.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Sản phẩm nổi bật' }),
  ).toBeVisible();
  const heroImage = page.getByRole('img', {
    name: 'Không gian căn hộ với camera, chuông cửa, khóa thông minh và bộ phát Wi-Fi',
  });
  await expect(heroImage).toBeVisible();
  await expect
    .poll(() =>
      heroImage.evaluate(
        (image) =>
          (image as HTMLImageElement).complete &&
          (image as HTMLImageElement).naturalWidth > 0,
      ),
    )
    .toBe(true);

  const productCards = page.getByTestId('featured-product-card');
  await expect(productCards).toHaveCount(catalog.data.items.length);
  for (const product of catalog.data.items) {
    await expect(
      productCards.getByRole('link', { name: product.name, exact: true }),
    ).toBeVisible();
  }
  const firstProductVisual = productCards
    .first()
    .locator('img, [role="img"]')
    .first();
  await expect(firstProductVisual).toBeVisible();
  await expect
    .poll(() =>
      firstProductVisual.evaluate(
        (element) =>
          element.getAttribute('alt') ?? element.getAttribute('aria-label'),
      ),
    )
    .toMatch(/.+/);
  await expect
    .poll(async () =>
      decodeURIComponent((await firstProductVisual.getAttribute('src')) ?? ''),
    )
    .toContain('/assets/images/products/');
  await expect(productCards.first()).toContainText(
    /Có gói lắp đặt|Chưa có gói lắp đặt/,
  );
});

test('supports primary navigation and product calls to action', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Dịch vụ lắp đặt' }).first().click();
  await expect(page).toHaveURL(/\/#installation$/);
  await expect(
    page.getByRole('heading', {
      name: 'Từ chọn mua đến nghiệm thu trong bốn bước',
    }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Khám phá sản phẩm' }).click();
  await expect(page).toHaveURL(/\/products$/);

  await page.goto('/');
  const firstCard = page.getByTestId('featured-product-card').first();
  const detailLink = firstCard.getByRole('link', { name: /^Xem chi tiết / });
  const destination = await detailLink.getAttribute('href');
  expect(destination).toMatch(/^\/products\//);
  await detailLink.click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
});

test('has no horizontal overflow at supported storefront widths', async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectNoHorizontalOverflow(page);

    const hero = page.getByTestId('customer-hero');
    const heading = hero.getByRole('heading', { level: 1 });
    const heroBox = await hero.boundingBox();
    const headingBox = await heading.boundingBox();
    expect(heroBox).not.toBeNull();
    expect(headingBox).not.toBeNull();

    if (viewport.width === 1440) {
      const desktopImage = page.getByTestId('customer-hero-image-desktop');
      await expect(desktopImage).toBeVisible();
      await expect(page.getByTestId('customer-hero-image-mobile')).toBeHidden();
      const imageBox = await desktopImage.boundingBox();
      expect(heroBox?.height).toBeGreaterThanOrEqual(600);
      expect(heroBox?.height).toBeLessThanOrEqual(700);
      expect(
        (headingBox?.x ?? 0) + (headingBox?.width ?? 0),
      ).toBeLessThanOrEqual(imageBox?.x ?? 0);
    } else {
      const mobileImage = page.getByTestId('customer-hero-image-mobile');
      await expect(mobileImage).toBeVisible();
      await expect(
        page.getByTestId('customer-hero-image-desktop'),
      ).toBeHidden();
      const imageBox = await mobileImage.boundingBox();
      expect(
        (headingBox?.y ?? 0) + (headingBox?.height ?? 0),
      ).toBeLessThanOrEqual(imageBox?.y ?? 0);
      await expect(
        hero.getByRole('link', { name: 'Khám phá sản phẩm' }),
      ).toBeVisible();
    }
  }
});
