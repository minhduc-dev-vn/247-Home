import { access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { getProductDemoImages } from '@/components/catalog/product-demo-images';
import { getProductImageStorage } from '@/modules/catalog/infrastructure/product-image-storage';
import { prisma } from '@/shared/db/client';

type AuditOptions = {
  cursor?: string;
  limit: number;
  strict: boolean;
  verifyObjects: boolean;
};

const managedCatalogKey =
  /^catalog-images\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

function parseOptions(argumentsList: string[]): AuditOptions {
  let cursor: string | undefined;
  let limit = 100;
  let strict = false;
  let verifyObjects = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--cursor') {
      cursor = argumentsList[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--limit') {
      const value = Number.parseInt(argumentsList[index + 1] ?? '', 10);
      if (!Number.isInteger(value) || value < 1 || value > 1_000)
        throw new Error('limit must be an integer from 1 to 1000.');
      limit = value;
      index += 1;
      continue;
    }
    if (argument === '--strict') {
      strict = true;
      continue;
    }
    if (argument === '--verify-objects') {
      verifyObjects = true;
      continue;
    }
    throw new Error(`Unsupported argument: ${argument}`);
  }

  return { cursor, limit, strict, verifyObjects };
}

function keyDigest(storageKey: string): string {
  return createHash('sha256').update(storageKey).digest('hex').slice(0, 12);
}

async function staticAssets(slug: string) {
  const images = getProductDemoImages(slug);
  const results = await Promise.all(
    images.map(async ({ src }) => {
      try {
        await access(path.join(process.cwd(), 'public', src));
        return true;
      } catch {
        return false;
      }
    }),
  );
  return { expected: images.length, present: results.filter(Boolean).length };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { id: 'asc' },
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    take: options.limit + 1,
    select: {
      id: true,
      slug: true,
      images: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, mimeType: true, storageKey: true },
      },
    },
  });
  const hasNextPage = products.length > options.limit;
  const page = products.slice(0, options.limit);
  const storage = options.verifyObjects ? getProductImageStorage() : null;
  let missingManagedObjects = 0;
  let legacyOrUnknownRows = 0;
  let missingStaticAssets = 0;

  const items = await Promise.all(
    page.map(async (product) => {
      const staticFallback = await staticAssets(product.slug);
      if (
        product.images.length === 0 &&
        staticFallback.expected > 0 &&
        staticFallback.expected !== staticFallback.present
      )
        missingStaticAssets += 1;

      const persistedImages = await Promise.all(
        product.images.map(async (image) => {
          const managed = managedCatalogKey.test(image.storageKey);
          if (!managed) legacyOrUnknownRows += 1;
          let exists: boolean | 'NOT_CHECKED' | 'UNAVAILABLE' = 'NOT_CHECKED';
          if (managed && storage) {
            try {
              exists = await storage.exists(image.storageKey);
              if (!exists) missingManagedObjects += 1;
            } catch {
              exists = 'UNAVAILABLE';
            }
          }
          return {
            id: image.id,
            keyDigest: keyDigest(image.storageKey),
            mimeType: image.mimeType,
            storageClass: managed
              ? 'MANAGED_CATALOG_OBJECT'
              : 'LEGACY_OR_UNKNOWN',
            objectExists: exists,
          };
        }),
      );

      return {
        id: product.id,
        slug: product.slug,
        source:
          persistedImages.length > 0
            ? 'PERSISTED_PRODUCT_IMAGE'
            : staticFallback.expected > 0
              ? 'STATIC_RELEASE_ASSET'
              : 'NO_MEDIA_CONFIGURED',
        staticFallback,
        persistedImages,
      };
    }),
  );

  const result = {
    event: 'catalog.media.audit.completed',
    objectVerification: options.verifyObjects ? 'REQUESTED' : 'NOT_REQUESTED',
    page: {
      itemCount: items.length,
      limit: options.limit,
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    },
    summary: {
      legacyOrUnknownRows,
      missingManagedObjects,
      missingStaticAssets,
      persistedImageRows: items.reduce(
        (total, item) => total + item.persistedImages.length,
        0,
      ),
      productsUsingStaticFallback: items.filter(
        (item) => item.source === 'STATIC_RELEASE_ASSET',
      ).length,
    },
    items,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);

  if (
    options.strict &&
    (missingManagedObjects > 0 ||
      legacyOrUnknownRows > 0 ||
      missingStaticAssets > 0)
  )
    process.exitCode = 2;
}

void (async () => {
  try {
    await main();
  } catch {
    process.stderr.write(
      `${JSON.stringify({ event: 'catalog.media.audit.failed' })}\n`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
