import { describe, expect, it } from 'vitest';

import { createProductImageStorage } from '@/modules/catalog/infrastructure/product-image-storage';
import { saveLocalProductImage } from '@/modules/catalog/infrastructure/local-image-storage';
import { maximumCatalogImageBytes } from '@/modules/storage';

describe('local product image storage', () => {
  it('rejects traversal-style filenames before writing', async () => {
    await expect(
      saveLocalProductImage({
        filename: '../product.png',
        contentType: 'image/png',
        contentBase64: 'iVBORw0KGgo=',
      }),
    ).rejects.toThrow('Invalid filename');
  });

  it('keeps catalog image uploads below the catalog-specific two MiB limit', async () => {
    const storage = createProductImageStorage({ NODE_ENV: 'test' });
    const oversized = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(maximumCatalogImageBytes),
    ]).toString('base64');

    await expect(
      storage.upload({
        filename: 'oversized.png',
        contentType: 'image/png',
        contentBase64: oversized,
      }),
    ).rejects.toThrow('size');
  });
});
