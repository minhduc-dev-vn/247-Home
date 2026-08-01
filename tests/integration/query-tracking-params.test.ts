import { randomUUID } from 'node:crypto';

import { OrderStatus, ProductCategory } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/auth/server', () => ({
  getCurrentActor: vi.fn(),
  requirePageRole: vi.fn(),
}));

import { GET as adminServiceAreasGet } from '../../app/api/v1/admin/service-areas/route';
import { GET as adminOperationsOrdersGet } from '../../app/api/v1/admin/operations/orders/route';
import { GET as adminOperationsAuditGet } from '../../app/api/v1/admin/operations/audit/route';
import { GET as adminOperationsAppointmentsGet } from '../../app/api/v1/admin/operations/appointments/route';
import { GET as addressesGet } from '../../app/api/v1/addresses/route';
import { GET as installationSlotsGet } from '../../app/api/v1/installation-slots/route';
import { GET as productsGet } from '../../app/api/v1/products/route';
import { GET as warrantyGet } from '../../app/api/v1/warranty/route';
import WarrantyPage from '../../app/(customer)/warranty/page';
import { listOrders } from '@/modules/commerce';
import { type IdentityActor } from '@/modules/identity';
import { getCurrentActor, requirePageRole } from '@/shared/auth/server';
import { prisma } from '@/shared/db/client';

const namespace = randomUUID().replaceAll('-', '');
const trackingQuery = 'utm_source=facebook&fbclid=IwAR0abc&gclid=Cj0KCQiA';

let customer: IdentityActor;
let manager: IdentityActor;
let serviceAreaId: string | undefined;
const createdOrderIds: string[] = [];

// Cleanup must never widen into an unfiltered delete when setup failed part
// way through: an `id: undefined` filter would match every row in the table.
function onlyDefined(...ids: Array<string | undefined>): string[] {
  return ids.filter((id): id is string => Boolean(id));
}

function actorMock() {
  return vi.mocked(getCurrentActor);
}

beforeAll(async () => {
  const [customerUser, managerUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: `qtp-customer-${namespace}@example.test`,
        name: 'Query customer',
        passwordHash: 'test-only-hash',
      },
    }),
    prisma.user.create({
      data: {
        email: `qtp-manager-${namespace}@example.test`,
        name: 'Query manager',
        passwordHash: 'test-only-hash',
      },
    }),
  ]);
  customer = {
    userId: customerUser.id,
    authVersion: 1,
    roles: ['CUSTOMER'],
  };
  manager = { userId: managerUser.id, authVersion: 1, roles: ['ADMIN'] };

  const serviceArea = await prisma.serviceArea.create({
    data: {
      code: `QTP-${namespace.slice(0, 12).toUpperCase()}`,
      provinceCode: `QP${namespace.slice(0, 6).toUpperCase()}`,
      provinceName: 'Query Province',
      districtCode: `QD${namespace.slice(0, 6).toUpperCase()}`,
      districtName: 'Query District',
      installationFee: 0,
      shippingFee: 0,
      isActive: true,
    },
  });
  serviceAreaId = serviceArea.id;

  const product = await prisma.product.create({
    data: {
      slug: `qtp-${namespace}`,
      name: 'Query product',
      description: 'Query params integration fixture.',
      category: ProductCategory.SECURITY_CAMERA,
      status: 'ACTIVE',
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `QTP-${namespace.slice(0, 16).toUpperCase()}`,
      name: 'Query variant',
      priceVnd: 100_000,
      inventory: { create: { onHand: 10, reserved: 0, version: 1 } },
    },
  });

  // Two orders in different statuses so the status filter has something to
  // discriminate between.
  for (const [index, status] of [
    OrderStatus.PENDING_CONFIRMATION,
    OrderStatus.COMPLETED,
  ].entries()) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORDER-QTP-${namespace.toUpperCase()}-${index}`,
        userId: customerUser.id,
        status,
        subtotal: 100_000n,
        installationFee: 0,
        shippingFee: 0,
        grandTotal: 100_000n,
        recipientName: 'Query Customer',
        recipientPhone: '0900000000',
        addressLine1: '1 Query Street',
        wardName: 'Query Ward',
        districtCode: 'QUERY-DISTRICT',
        districtName: 'Query District',
        provinceCode: 'QUERY-PROVINCE',
        provinceName: 'Query Province',
        countryCode: 'VN',
        idempotencyHash: `qtp-${namespace}-${index}`,
        requestFingerprint: `qtp-${namespace}-${index}`,
        items: {
          create: [
            {
              productVariantId: variant.id,
              productName: product.name,
              variantName: 'Query variant',
              sku: `QTP-${namespace.slice(0, 16).toUpperCase()}`,
              quantity: 1,
              deviceUnitPrice: 100_000,
              serviceUnitPrice: 0,
              unitPrice: 100_000,
              lineTotal: 100_000,
            },
          ],
        },
        payment: {
          create: {
            method: 'COD',
            status: 'PENDING',
            amount: 100_000n,
            referenceCode: `PAY-QTP-${namespace.toUpperCase()}-${index}`,
          },
        },
      },
    });
    createdOrderIds.push(order.id);
  }
});

afterAll(async () => {
  await prisma.payment.deleteMany({
    where: { orderId: { in: createdOrderIds } },
  });
  await prisma.orderItem.deleteMany({
    where: { orderId: { in: createdOrderIds } },
  });
  await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  await prisma.inventory.deleteMany({
    where: { productVariant: { product: { slug: `qtp-${namespace}` } } },
  });
  await prisma.productVariant.deleteMany({
    where: { product: { slug: `qtp-${namespace}` } },
  });
  await prisma.product.deleteMany({ where: { slug: `qtp-${namespace}` } });
  await prisma.serviceArea.deleteMany({
    where: { id: { in: onlyDefined(serviceAreaId) } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: onlyDefined(customer?.userId, manager?.userId) } },
  });
  await prisma.$disconnect();
});

describe('tracking parameters no longer break shared links', () => {
  it('GET /api/v1/products', async () => {
    actorMock().mockResolvedValue(null);

    const response = await productsGet(
      new Request(`http://localhost/api/v1/products?${trackingQuery}`),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it('GET /api/v1/installation-slots', async () => {
    actorMock().mockResolvedValue(null);

    const response = await installationSlotsGet(
      new Request(
        `http://localhost/api/v1/installation-slots?serviceAreaId=${serviceAreaId}&fromDate=2026-07-01&toDate=2026-07-10&${trackingQuery}`,
      ),
    );

    expect(response.status).toBe(200);
  });

  it('GET /api/v1/addresses', async () => {
    actorMock().mockResolvedValue(customer);

    const response = await addressesGet(
      new Request(`http://localhost/api/v1/addresses?${trackingQuery}`),
    );

    expect(response.status).toBe(200);
  });

  it('GET /api/v1/warranty', async () => {
    actorMock().mockResolvedValue(customer);

    const response = await warrantyGet(
      new Request(`http://localhost/api/v1/warranty?${trackingQuery}`),
    );

    expect(response.status).toBe(200);
  });

  it('GET /api/v1/admin/service-areas', async () => {
    actorMock().mockResolvedValue(manager);

    const response = await adminServiceAreasGet(
      new Request(
        `http://localhost/api/v1/admin/service-areas?${trackingQuery}`,
      ),
    );

    expect(response.status).toBe(200);
  });

  it.each([
    ['orders', adminOperationsOrdersGet, 'orders'],
    ['audit', adminOperationsAuditGet, 'audit'],
    ['appointments', adminOperationsAppointmentsGet, 'appointments'],
  ] as const)(
    'GET /api/v1/admin/operations/%s',
    async (_name, handler, segment) => {
      actorMock().mockResolvedValue(manager);

      const response = await handler(
        new Request(
          `http://localhost/api/v1/admin/operations/${segment}?${trackingQuery}`,
        ),
      );

      expect(response.status).toBe(200);
    },
  );

  it('still rejects a genuinely invalid query value', async () => {
    actorMock().mockResolvedValue(null);

    const response = await productsGet(
      new Request(
        `http://localhost/api/v1/products?limit=abc&${trackingQuery}`,
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });
});

describe('warranty page survives a damaged cursor from a shared link', () => {
  it.each([
    ['empty', ''],
    ['truncated', 'cms1yqk8j0000fnh'],
    ['not a cuid at all', 'page-2'],
    ['tracking value pasted in', 'IwAR0abc123'],
  ])('falls back to page one for a %s cursor', async (_name, cursor) => {
    vi.mocked(requirePageRole).mockResolvedValue(customer);

    await expect(
      WarrantyPage({
        searchParams: Promise.resolve({ cursor }),
      }),
    ).resolves.toBeTruthy();
  });

  it('still honours a well formed cursor', async () => {
    vi.mocked(requirePageRole).mockResolvedValue(customer);

    await expect(
      WarrantyPage({
        searchParams: Promise.resolve({ cursor: 'cms1yqk8j0000fnh0ze26p402' }),
      }),
    ).resolves.toBeTruthy();
  });
});

describe('customer order status filter runs on the server', () => {
  it('returns only the requested status across the whole account', async () => {
    const completed = await listOrders(customer, {
      limit: 25,
      status: OrderStatus.COMPLETED,
    });

    expect(completed.items).toHaveLength(1);
    expect(completed.items[0].status).toBe(OrderStatus.COMPLETED);
    expect(completed.nextCursor).toBeNull();
  });

  it('paginates within the filtered set, not the unfiltered one', async () => {
    // One COMPLETED order exists; asking for a page of one must not advertise
    // a next page built from the other status.
    const firstPage = await listOrders(customer, {
      limit: 1,
      status: OrderStatus.COMPLETED,
    });

    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).toBeNull();

    const unfiltered = await listOrders(customer, { limit: 1 });
    expect(unfiltered.items).toHaveLength(1);
    expect(unfiltered.nextCursor).not.toBeNull();
  });

  it('returns every order when no status is supplied', async () => {
    const all = await listOrders(customer, { limit: 25 });

    expect(all.items).toHaveLength(2);
  });
});
