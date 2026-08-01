import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/auth/server', () => ({ getCurrentActor: vi.fn() }));

import { POST as createProductImage } from '../../app/api/v1/admin/products/[id]/images/route';
import { GET as getProductImage } from '../../app/api/v1/product-images/[id]/route';
import { getPublicProduct } from '@/modules/catalog';
import { getCurrentActor } from '@/shared/auth/server';
import { type IdentityActor } from '@/modules/identity';
import { getProductImageStorage } from '@/modules/catalog/infrastructure/product-image-storage';
import { resetCatalogImageStorageForTests } from '@/modules/storage';
import { isCatalogImageStorageKey } from '@/modules/storage';
import { prisma } from '@/shared/db/client';
import {
  startS3CompatibleTestServer,
  type S3CompatibleTestServer,
} from '../support/s3-compatible-test-server';

const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/gL+W4Mk1QAAAABJRU5ErkJggg==';
const storageEnvironmentKeys = [
  'CATALOG_IMAGE_STORAGE_PROVIDER',
  'CATALOG_IMAGE_STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY',
  'STORAGE_BUCKET',
  'STORAGE_ENDPOINT',
  'STORAGE_FORCE_PATH_STYLE',
  'STORAGE_REGION',
  'STORAGE_SECRET_KEY',
] as const;

const originalEnvironment = new Map(
  storageEnvironmentKeys.map((key) => [key, process.env[key]]),
);
const productIds: string[] = [];

let admin: IdentityActor = {
  userId: '',
  authVersion: 1,
  roles: ['ADMIN'],
};
let storageServer: S3CompatibleTestServer;

function missingProductId() {
  return `c${randomUUID().replaceAll('-', '').slice(0, 24)}`;
}

async function createProductFixture(status: 'ACTIVE' | 'DRAFT') {
  const suffix = randomUUID().replaceAll('-', '');
  const product = await prisma.product.create({
    data: {
      slug: `catalog-media-${suffix}`,
      name: 'Catalog media integration product',
      description: 'Product used only to verify private catalog media.',
      category: 'SECURITY_CAMERA',
      status,
      variants: {
        create: {
          sku: `CAT-MEDIA-${suffix.slice(0, 14).toUpperCase()}`,
          name: 'Catalog media variant',
          priceVnd: 1_000_000n,
          inventory: { create: { onHand: 1, reserved: 0 } },
        },
      },
    },
  });
  productIds.push(product.id);
  return product;
}

function imageRequest(productId: string, altText = 'Catalog image test') {
  return new Request(
    `http://localhost:3000/api/v1/admin/products/${productId}/images`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        filename: 'catalog-image.png',
        contentType: 'image/png',
        contentBase64: pngBase64,
        altText,
      }),
    },
  );
}

describe('catalog media on private S3-compatible storage', () => {
  beforeAll(async () => {
    storageServer = await startS3CompatibleTestServer();
    process.env.CATALOG_IMAGE_STORAGE_PROVIDER = 's3';
    process.env.CATALOG_IMAGE_STORAGE_BUCKET = 'catalog-media-test';
    process.env.STORAGE_REGION = 'us-east-1';
    process.env.STORAGE_ENDPOINT = storageServer.endpoint;
    process.env.STORAGE_ACCESS_KEY = 'catalog-test-access-key';
    process.env.STORAGE_SECRET_KEY = 'catalog-test-secret-key';
    process.env.STORAGE_FORCE_PATH_STYLE = 'true';
    resetCatalogImageStorageForTests();

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@example.com' },
    });
    admin = { ...admin, userId: user.id };
  });

  it('persists a private object, proxies an active product image, and audits without exposing its storage key', async () => {
    const product = await createProductFixture('ACTIVE');
    vi.mocked(getCurrentActor).mockResolvedValue(admin);

    const created = await createProductImage(imageRequest(product.id), {
      params: Promise.resolve({ id: product.id }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      data: { id: string; storageKey?: string };
    };
    expect(body.data.id).toMatch(/^c/);
    expect(body.data).not.toHaveProperty('storageKey');
    expect(storageServer.objectCount()).toBe(1);

    const preview = await getProductImage(
      new Request(
        `http://localhost:3000/api/v1/product-images/${body.data.id}`,
      ),
      { params: Promise.resolve({ id: body.data.id }) },
    );
    expect(preview.status).toBe(200);
    expect(preview.headers.get('Content-Type')).toBe('image/png');
    expect(preview.headers.get('Cache-Control')).toContain('public');
    expect(preview.headers.get('Content-Disposition')).toBe('inline');
    expect(Buffer.from(await preview.arrayBuffer())).toEqual(
      Buffer.from(pngBase64, 'base64'),
    );
    await expect(
      prisma.auditLog.findFirstOrThrow({
        where: {
          action: 'catalog.product-image-created',
          targetId: body.data.id,
        },
      }),
    ).resolves.toMatchObject({ actorUserId: admin.userId });
  });

  it('does not expose a draft product image by its identifier', async () => {
    const product = await createProductFixture('DRAFT');
    vi.mocked(getCurrentActor).mockResolvedValue(admin);
    const created = await createProductImage(imageRequest(product.id), {
      params: Promise.resolve({ id: product.id }),
    });
    const body = (await created.json()) as { data: { id: string } };

    const preview = await getProductImage(
      new Request(
        `http://localhost:3000/api/v1/product-images/${body.data.id}`,
      ),
      { params: Promise.resolve({ id: body.data.id }) },
    );
    expect(preview.status).toBe(404);
  });

  it('does not let a legacy local key override the static catalog fallback', async () => {
    const product = await createProductFixture('ACTIVE');
    const legacyImage = await prisma.productImage.create({
      data: {
        productId: product.id,
        storageKey: `${randomUUID()}.png`,
        altText: 'Legacy local product image',
        mimeType: 'image/png',
        byteSize: 1,
        sortOrder: 0,
      },
    });

    const detail = await getPublicProduct(product.slug);
    expect(detail?.images).toEqual([]);

    const preview = await getProductImage(
      new Request(
        `http://localhost:3000/api/v1/product-images/${legacyImage.id}`,
      ),
      { params: Promise.resolve({ id: legacyImage.id }) },
    );
    expect(preview.status).toBe(404);
  });

  it('authorizes before upload and compensates the object when database persistence fails', async () => {
    const product = await createProductFixture('ACTIVE');
    const before = storageServer.objectCount();
    vi.mocked(getCurrentActor).mockResolvedValue({
      ...admin,
      roles: ['CUSTOMER'],
    });
    const denied = await createProductImage(imageRequest(product.id), {
      params: Promise.resolve({ id: product.id }),
    });
    expect(denied.status).toBe(403);
    expect(storageServer.objectCount()).toBe(before);

    vi.mocked(getCurrentActor).mockResolvedValue(admin);
    const unknownProductId = missingProductId();
    const failedPersistence = await createProductImage(
      imageRequest(unknownProductId, 'Cleanup-after-database-failure'),
      { params: Promise.resolve({ id: unknownProductId }) },
    );
    expect(failedPersistence.status).toBe(404);
    expect(storageServer.objectCount()).toBe(before);
  });
});

afterAll(async () => {
  try {
    const variants = await prisma.productVariant.findMany({
      where: { productId: { in: productIds } },
      select: { id: true },
    });
    const images = await prisma.productImage.findMany({
      where: { productId: { in: productIds } },
      select: { id: true, storageKey: true },
    });
    await Promise.all(
      images
        .filter(({ storageKey }) => isCatalogImageStorageKey(storageKey))
        .map(({ storageKey }) => getProductImageStorage().delete(storageKey)),
    );
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: images.map(({ id }) => id) } },
    });
    await prisma.productImage.deleteMany({
      where: { id: { in: images.map(({ id }) => id) } },
    });
    await prisma.inventory.deleteMany({
      where: { productVariantId: { in: variants.map(({ id }) => id) } },
    });
    await prisma.productVariant.deleteMany({
      where: { id: { in: variants.map(({ id }) => id) } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  } finally {
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetCatalogImageStorageForTests();
    await storageServer?.close();
    await prisma.$disconnect();
  }
});
