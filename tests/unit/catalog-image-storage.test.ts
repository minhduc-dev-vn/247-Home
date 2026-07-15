import { describe, expect, it } from 'vitest';

import { saveLocalProductImage } from '@/modules/catalog/infrastructure/local-image-storage';

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
});
