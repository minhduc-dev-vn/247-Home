import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/auth/server', () => ({ getCurrentActor: vi.fn() }));
vi.mock('@/modules/catalog/infrastructure/local-image-storage', () => ({
  LocalImageStorageError: class LocalImageStorageError extends Error {},
  removeLocalProductImage: vi.fn(),
  saveLocalProductImage: vi.fn(),
}));

import { GET as adminProductsGet } from '../../app/api/v1/admin/products/route';
import { POST as adminProductImagePost } from '../../app/api/v1/admin/products/[id]/images/route';
import { POST as adminServiceAreasPost } from '../../app/api/v1/admin/service-areas/route';
import {
  adjustInventory,
  checkServiceArea,
  createProduct,
  createServiceArea,
  createVariant,
  listPublicProducts,
  updateServiceArea,
  updateVariant,
} from '@/modules/catalog';
import { getCurrentActor } from '@/shared/auth/server';
import { type IdentityActor } from '@/modules/identity';
import { saveLocalProductImage } from '@/modules/catalog/infrastructure/local-image-storage';
import { prisma } from '@/shared/db/client';

const createdProductIds: string[] = [];
const createdVariantIds: string[] = [];
const createdServiceAreaIds: string[] = [];

let admin: IdentityActor = {
  userId: '',
  authVersion: 1,
  roles: ['ADMIN'],
};
const staff: IdentityActor = {
  userId: 'staff-test',
  authVersion: 1,
  roles: ['STAFF'],
};
const customer: IdentityActor = {
  userId: 'customer-test',
  authVersion: 1,
  roles: ['CUSTOMER'],
};

async function createCatalogFixture() {
  const suffix = randomUUID().replaceAll('-', '');
  const product = await createProduct(admin, {
    slug: `integration-${suffix}`,
    name: 'Integration product',
    description: 'A product used only by integration tests.',
    category: 'SECURITY_CAMERA',
  });
  createdProductIds.push(product.id);
  const variant = await createVariant(
    admin,
    {
      productId: product.id,
      sku: `INT-${suffix.slice(0, 12).toUpperCase()}`,
      name: 'Integration variant',
      priceVnd: '1200000',
    },
    `test_${suffix}`,
  );
  createdVariantIds.push(variant.id);
  await prisma.inventory.update({
    where: { productVariantId: variant.id },
    data: { onHand: 5 },
  });
  return { product, variant };
}

describe('catalog persistence and authorization', () => {
  beforeAll(async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@example.com' },
    });
    admin = { ...admin, userId: user.id };
  });

  it('does not expose stock counters in the public catalog', async () => {
    const catalog = await listPublicProducts({ limit: 12 });
    expect(catalog.items.length).toBeGreaterThanOrEqual(12);
    expect(catalog.items[0]).not.toHaveProperty('onHand');
    const variant = catalog.items.flatMap((item) => item.variants).at(0);
    expect(variant).toBeDefined();
    expect(variant).not.toHaveProperty('inventory');
  });

  it('returns a service area match from server-side codes', async () => {
    await expect(checkServiceArea('HCM', 'Q1')).resolves.toMatchObject({
      status: 'SUPPORTED',
      area: { code: 'HCM-Q1' },
    });
  });

  it('rejects a staff price change and records an admin price change in audit', async () => {
    const { variant } = await createCatalogFixture();
    await expect(
      updateVariant(staff, variant.id, { priceVnd: '1300000' }, 'staff-change'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await updateVariant(
      admin,
      variant.id,
      { priceVnd: '1300000' },
      'admin-change',
    );
    await expect(
      prisma.auditLog.findFirst({
        where: {
          action: 'catalog.variant-price-updated',
          targetId: variant.id,
        },
      }),
    ).resolves.toMatchObject({
      actorUserId: admin.userId,
      before: { priceVnd: '1200000' },
      after: { priceVnd: '1300000' },
    });
  });

  it('protects inventory invariant and audits a successful adjustment', async () => {
    const { variant } = await createCatalogFixture();
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productVariantId: variant.id },
    });
    await expect(
      adjustInventory(
        admin,
        variant.id,
        {
          delta: -6,
          expectedVersion: inventory.version,
          reason: 'Integration check',
        },
        'stock-reject',
      ),
    ).rejects.toMatchObject({ code: 'INVENTORY_CONFLICT' });
    await expect(
      adjustInventory(
        admin,
        variant.id,
        {
          delta: 3,
          expectedVersion: inventory.version,
          reason: 'Integration restock',
        },
        'stock-accept',
      ),
    ).resolves.toMatchObject({ available: 8, version: inventory.version + 1 });
    await expect(
      prisma.auditLog.findFirst({
        where: { action: 'inventory.adjusted', targetId: variant.id },
      }),
    ).resolves.toMatchObject({ reason: 'Integration restock' });
  });

  it('writes service-area fee changes and their audit atomically', async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const area = await createServiceArea(
      admin,
      {
        code: `AREA-${suffix.slice(0, 16).toUpperCase()}`,
        provinceCode: `P${suffix.slice(0, 8)}`,
        provinceName: 'Audit Province',
        districtCode: `D${suffix.slice(0, 8)}`,
        districtName: 'Audit District',
        installationFeeVnd: '100000',
        shippingFeeVnd: '20000',
      },
      `service-area-create-${suffix}`,
    );
    createdServiceAreaIds.push(area.id);

    await updateServiceArea(
      admin,
      area.id,
      { installationFeeVnd: '125000' },
      `service-area-update-${suffix}`,
    );
    await expect(
      prisma.auditLog.findFirstOrThrow({
        where: {
          targetId: area.id,
          action: 'catalog.service-area-updated',
        },
      }),
    ).resolves.toMatchObject({
      actorUserId: admin.userId,
      before: { installationFeeVnd: '100000', shippingFeeVnd: '20000' },
      after: { installationFeeVnd: '125000', shippingFeeVnd: '20000' },
    });
  });

  it('serializes admin money fields as decimal strings at the HTTP boundary', async () => {
    const suffix = randomUUID().replaceAll('-', '');
    vi.mocked(getCurrentActor).mockResolvedValue(admin);
    const response = await adminServiceAreasPost(
      new Request('http://localhost:3000/api/v1/admin/service-areas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          code: `HTTP-${suffix.slice(0, 16).toUpperCase()}`,
          provinceCode: `HP${suffix.slice(0, 8)}`,
          provinceName: 'HTTP Province',
          districtCode: `HD${suffix.slice(0, 8)}`,
          districtName: 'HTTP District',
          installationFeeVnd: '999999999999999',
          shippingFeeVnd: '25000',
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: {
        id: string;
        installationFeeVnd: string;
        shippingFeeVnd: string;
      };
    };
    createdServiceAreaIds.push(body.data.id);
    expect(body.data).toMatchObject({
      installationFeeVnd: '999999999999999',
      shippingFeeVnd: '25000',
    });
  });

  it('returns 403 when a customer calls the catalog administration route', async () => {
    vi.mocked(getCurrentActor).mockResolvedValue(customer);
    const response = await adminProductsGet(
      new Request('http://localhost/api/v1/admin/products'),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
  });

  it('authorizes product-image upload before writing to local storage', async () => {
    const { product } = await createCatalogFixture();
    vi.mocked(getCurrentActor).mockResolvedValue(customer);
    const response = await adminProductImagePost(
      new Request(
        `http://localhost:3000/api/v1/admin/products/${product.id}/images`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://localhost:3000',
          },
          body: JSON.stringify({
            filename: 'product.png',
            contentType: 'image/png',
            contentBase64: 'iVBORw0KGgo=',
            altText: 'Unauthorized upload probe',
          }),
        },
      ),
      { params: Promise.resolve({ id: product.id }) },
    );

    expect(response.status).toBe(403);
    expect(saveLocalProductImage).not.toHaveBeenCalled();
  });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      targetId: {
        in: [
          ...createdProductIds,
          ...createdVariantIds,
          ...createdServiceAreaIds,
        ],
      },
    },
  });
  await prisma.serviceArea.deleteMany({
    where: { id: { in: createdServiceAreaIds } },
  });
  await prisma.inventory.deleteMany({
    where: { productVariantId: { in: createdVariantIds } },
  });
  await prisma.productVariant.deleteMany({
    where: { id: { in: createdVariantIds } },
  });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.$disconnect();
});
