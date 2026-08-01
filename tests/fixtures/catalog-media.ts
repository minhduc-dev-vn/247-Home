import { randomUUID } from 'node:crypto';

import {
  createProductImageStorage,
  type ProductImageStorage,
} from '@/modules/catalog/infrastructure/product-image-storage';
import { prisma } from '@/shared/db/client';

const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/gL+W4Mk1QAAAABJRU5ErkJggg==';

export type CatalogMediaFixture = {
  altText: string;
  cleanup(): Promise<void>;
  imageId: string;
  productName: string;
  slug: string;
};

function catalogMediaStorageEnvironment(): Record<string, string | undefined> {
  if (process.env.CATALOG_MEDIA_E2E_STORAGE_PROVIDER !== 's3') {
    return { NODE_ENV: 'test' };
  }

  return {
    NODE_ENV: 'test',
    CATALOG_IMAGE_STORAGE_PROVIDER: 's3',
    CATALOG_IMAGE_STORAGE_BUCKET: process.env.CATALOG_IMAGE_STORAGE_BUCKET,
    STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
    STORAGE_BUCKET: process.env.STORAGE_BUCKET,
    STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
    STORAGE_FORCE_PATH_STYLE: process.env.STORAGE_FORCE_PATH_STYLE,
    STORAGE_REGION: process.env.STORAGE_REGION,
    STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
  };
}

export async function createCatalogMediaFixture(): Promise<CatalogMediaFixture> {
  const suffix = randomUUID().replaceAll('-', '');
  const slug = `catalog-media-e2e-${suffix}`;
  const productName = 'Persisted catalog media e2e product';
  const altText = 'Persisted catalog media e2e image';
  const storage: ProductImageStorage = createProductImageStorage(
    catalogMediaStorageEnvironment(),
  );
  const stored = await storage.upload({
    filename: 'persisted-catalog-image.png',
    contentType: 'image/png',
    contentBase64: pngBase64,
  });

  try {
    const product = await prisma.product.create({
      data: {
        slug,
        name: productName,
        description: 'Product fixture with a private persisted catalog image.',
        category: 'SECURITY_CAMERA',
        status: 'ACTIVE',
        variants: {
          create: {
            sku: `CAT-E2E-${suffix.slice(0, 14).toUpperCase()}`,
            name: 'Persisted media variant',
            priceVnd: 1_000_000n,
            inventory: { create: { onHand: 1, reserved: 0 } },
          },
        },
        images: {
          create: {
            storageKey: stored.storageKey,
            altText,
            mimeType: stored.contentType,
            byteSize: stored.byteSize,
            sortOrder: 0,
          },
        },
      },
      select: {
        id: true,
        images: { select: { id: true } },
        variants: { select: { id: true } },
      },
    });
    const imageId = product.images[0]?.id;
    const variantId = product.variants[0]?.id;
    if (!imageId || !variantId)
      throw new Error('Catalog media fixture was not fully created.');

    return {
      altText,
      imageId,
      productName,
      slug,
      cleanup: async () => {
        await storage.delete(stored.storageKey);
        await prisma.productImage.delete({ where: { id: imageId } });
        await prisma.inventory.delete({
          where: { productVariantId: variantId },
        });
        await prisma.productVariant.delete({ where: { id: variantId } });
        await prisma.product.delete({ where: { id: product.id } });
      },
    };
  } catch (error: unknown) {
    await storage.delete(stored.storageKey).catch(() => undefined);
    throw error;
  }
}
