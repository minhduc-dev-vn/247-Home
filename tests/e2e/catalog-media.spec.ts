import { expect, test } from '@playwright/test';

import { createCatalogMediaFixture } from '../fixtures/catalog-media';

test('renders a persisted catalog image through the authorized storage proxy', async ({
  page,
  request,
}) => {
  const fixture = await createCatalogMediaFixture();
  try {
    const preview = await request.get(
      `/api/v1/product-images/${fixture.imageId}`,
    );
    expect(preview.status()).toBe(200);
    expect(preview.headers()['content-type']).toBe('image/png');
    expect(preview.headers()['cache-control']).toContain('public');
    expect(preview.headers()['content-disposition']).toBe('inline');

    await page.goto(`/products/${fixture.slug}`);
    await expect(
      page.getByRole('heading', { name: fixture.productName }),
    ).toBeVisible();
    const image = page.getByAltText(fixture.altText).first();
    await expect(image).toBeVisible();
    await expect
      .poll(async () =>
        decodeURIComponent((await image.getAttribute('src')) ?? ''),
      )
      .toContain(`/api/v1/product-images/${fixture.imageId}`);
    await expect
      .poll(() =>
        image.evaluate(
          (element) =>
            (element as HTMLImageElement).complete &&
            (element as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  } finally {
    await fixture.cleanup();
  }
});
