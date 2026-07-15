import { randomUUID } from 'node:crypto';

import {
  InventoryDisposition,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductCategory,
  type Product,
  type ProductVariant,
} from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { transitionOrder } from '@/modules/commerce';
import { type IdentityActor } from '@/modules/identity';
import { prisma } from '@/shared/db/client';
import { withApiHandler } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

type VariantInput = {
  quantity: number;
  onHand: number;
  reserved: number;
  version?: number;
};

async function createOrderFixture(options: {
  status: OrderStatus;
  inventoryStatus?: InventoryDisposition;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  variants?: VariantInput[];
}) {
  const namespace = randomUUID().replaceAll('-', '');
  const [manager, customer] = await Promise.all([
    prisma.user.create({
      data: {
        email: `order-manager-${namespace}@example.test`,
        name: 'Order transition manager',
        passwordHash: 'test-only-hash',
      },
    }),
    prisma.user.create({
      data: {
        email: `order-customer-${namespace}@example.test`,
        name: 'Order transition customer',
        passwordHash: 'test-only-hash',
      },
    }),
  ]);
  const actor: IdentityActor = {
    userId: manager.id,
    authVersion: 1,
    roles: ['MANAGER'],
  };
  const variantInputs = options.variants ?? [
    { quantity: 1, onHand: 5, reserved: 1 },
  ];
  const products: Product[] = [];
  const variants: Array<ProductVariant & { input: VariantInput }> = [];
  for (const [index, input] of variantInputs.entries()) {
    const product = await prisma.product.create({
      data: {
        slug: `order-transition-${namespace}-${index}`,
        name: `Order transition product ${index}`,
        description: 'PostgreSQL integration fixture.',
        category: ProductCategory.SECURITY_CAMERA,
        status: 'ACTIVE',
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `ORD-${namespace.slice(0, 16).toUpperCase()}-${index}`,
        name: `Variant ${index}`,
        priceVnd: 100_000,
        inventory: {
          create: {
            onHand: input.onHand,
            reserved: input.reserved,
            version: input.version ?? 1,
          },
        },
      },
    });
    products.push(product);
    variants.push({ ...variant, input });
  }

  const subtotal = BigInt(
    variantInputs.reduce((total, input) => total + input.quantity * 100_000, 0),
  );
  const inventoryStatus =
    options.inventoryStatus ?? InventoryDisposition.RESERVED;
  const order = await prisma.order.create({
    data: {
      orderNumber: `ORDER-${namespace.toUpperCase()}`,
      userId: customer.id,
      status: options.status,
      inventoryStatus,
      subtotal,
      installationFee: 0,
      shippingFee: 0,
      grandTotal: subtotal,
      recipientName: 'Order Fixture Customer',
      recipientPhone: '0900000000',
      addressLine1: '1 Test Street',
      wardName: 'Test Ward',
      districtCode: 'TEST-DISTRICT',
      districtName: 'Test District',
      provinceCode: 'TEST-PROVINCE',
      provinceName: 'Test Province',
      countryCode: 'VN',
      idempotencyHash: `order-${namespace}`,
      requestFingerprint: `order-${namespace}`,
      items: {
        create: variants.map(({ id, sku, name }, index) => ({
          productVariantId: id,
          productName: products[index].name,
          variantName: name,
          sku,
          quantity: variantInputs[index].quantity,
          deviceUnitPrice: 100_000,
          serviceUnitPrice: 0,
          unitPrice: 100_000,
          lineTotal: 100_000 * variantInputs[index].quantity,
        })),
      },
      payment: {
        create: {
          method: options.paymentMethod ?? PaymentMethod.COD,
          status: options.paymentStatus ?? PaymentStatus.PENDING,
          amount: subtotal,
          referenceCode: `PAY-${namespace.toUpperCase()}`,
        },
      },
    },
    include: {
      items: { select: { id: true, productVariantId: true, quantity: true } },
    },
  });
  const lifecycleAt = new Date();
  await prisma.inventoryAllocation.createMany({
    data: order.items.map((item) => ({
      orderItemId: item.id,
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      status: inventoryStatus,
      ...(inventoryStatus === InventoryDisposition.CONSUMED
        ? { consumedAt: lifecycleAt }
        : {}),
      ...(inventoryStatus === InventoryDisposition.RELEASED
        ? { releasedAt: lifecycleAt }
        : {}),
    })),
  });

  return {
    actor,
    order,
    variants,
    async cleanup() {
      await prisma.auditLog.deleteMany({ where: { targetId: order.id } });
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.inventoryAllocation.deleteMany({
        where: { orderItemId: { in: order.items.map(({ id }) => id) } },
      });
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.inventory.deleteMany({
        where: { productVariantId: { in: variants.map(({ id }) => id) } },
      });
      await prisma.productVariant.deleteMany({
        where: { id: { in: variants.map(({ id }) => id) } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: products.map(({ id }) => id) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [manager.id, customer.id] } },
      });
    },
  };
}

async function withFixture(
  options: Parameters<typeof createOrderFixture>[0],
  run: (
    fixture: Awaited<ReturnType<typeof createOrderFixture>>,
  ) => Promise<void>,
) {
  const fixture = await createOrderFixture(options);
  try {
    await run(fixture);
  } finally {
    await fixture.cleanup();
  }
}

describe.sequential('admin order transition transaction invariants', () => {
  it('allows only one concurrent confirm for the same expected version', async () => {
    await withFixture(
      { status: OrderStatus.PENDING_CONFIRMATION },
      async ({ actor, order }) => {
        const requestIds = [
          `confirm-a-${randomUUID()}`,
          `confirm-b-${randomUUID()}`,
        ];
        const responses = await Promise.all(
          requestIds.map((requestId, index) =>
            withApiHandler(
              new Request('http://localhost/api/v1/admin/orders/actions', {
                headers: { 'x-request-id': requestId },
              }),
              async (handledRequestId) =>
                createSuccessResponse(
                  await transitionOrder(
                    actor,
                    order.id,
                    'confirm',
                    order.version,
                    `Concurrent confirmation ${index}`,
                    handledRequestId,
                  ),
                  handledRequestId,
                ),
            ),
          ),
        );
        expect(responses.map(({ status }) => status).sort()).toEqual([
          200, 409,
        ]);
        const success = responses.find(({ status }) => status === 200);
        await expect(success?.json()).resolves.toMatchObject({
          data: {
            id: order.id,
            status: OrderStatus.CONFIRMED,
            version: order.version + 1,
          },
        });
        const conflict = responses.find(({ status }) => status === 409);
        await expect(conflict?.json()).resolves.toMatchObject({
          error: { code: 'CONCURRENT_MODIFICATION' },
        });
        await expect(
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        ).resolves.toMatchObject({
          status: OrderStatus.CONFIRMED,
          version: order.version + 1,
        });
        await expect(
          prisma.auditLog.count({
            where: { requestId: { in: requestIds }, targetId: order.id },
          }),
        ).resolves.toBe(1);
      },
    );
  });

  it('consumes reserved inventory exactly once when marking ready', async () => {
    await withFixture(
      {
        status: OrderStatus.PROCESSING,
        variants: [{ quantity: 2, onHand: 5, reserved: 2 }],
      },
      async ({ actor, order, variants }) => {
        const requestId = `mark-ready-${randomUUID()}`;
        await expect(
          transitionOrder(
            actor,
            order.id,
            'mark-ready-for-installation',
            order.version,
            'Devices prepared for installation',
            requestId,
          ),
        ).resolves.toMatchObject({
          status: OrderStatus.READY_FOR_INSTALLATION,
          inventoryStatus: InventoryDisposition.CONSUMED,
          version: order.version + 1,
        });
        await expect(
          prisma.inventory.findUniqueOrThrow({
            where: { productVariantId: variants[0].id },
          }),
        ).resolves.toMatchObject({ onHand: 3, reserved: 0, version: 2 });
        await expect(
          prisma.inventoryAllocation.findUniqueOrThrow({
            where: { orderItemId: order.items[0].id },
          }),
        ).resolves.toMatchObject({
          status: InventoryDisposition.CONSUMED,
          consumedAt: expect.any(Date),
        });

        await expect(
          transitionOrder(
            actor,
            order.id,
            'mark-ready-for-installation',
            order.version,
            'Retry stale mark ready',
            `retry-${requestId}`,
          ),
        ).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' });
        await expect(
          prisma.inventory.findUniqueOrThrow({
            where: { productVariantId: variants[0].id },
          }),
        ).resolves.toMatchObject({ onHand: 3, reserved: 0, version: 2 });
        await expect(
          prisma.inventoryAllocation.count({
            where: {
              orderItemId: order.items[0].id,
              status: InventoryDisposition.CONSUMED,
            },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.auditLog.count({
            where: {
              targetId: order.id,
              action: 'order.mark-ready-for-installation',
            },
          }),
        ).resolves.toBe(1);
      },
    );
  });

  it('rolls back the whole transition when one reservation is missing', async () => {
    await withFixture(
      {
        status: OrderStatus.PROCESSING,
        variants: [
          { quantity: 1, onHand: 4, reserved: 1 },
          { quantity: 1, onHand: 4, reserved: 1 },
        ],
      },
      async ({ actor, order, variants }) => {
        await prisma.inventoryAllocation.delete({
          where: { orderItemId: order.items[1].id },
        });
        await expect(
          transitionOrder(
            actor,
            order.id,
            'mark-ready-for-installation',
            order.version,
            'Reservation is incomplete',
            `missing-reservation-${randomUUID()}`,
          ),
        ).rejects.toMatchObject({ code: 'INVENTORY_CONFLICT' });
        await expect(
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        ).resolves.toMatchObject({
          status: OrderStatus.PROCESSING,
          inventoryStatus: InventoryDisposition.RESERVED,
          version: order.version,
        });
        const inventories = await prisma.inventory.findMany({
          where: { productVariantId: { in: variants.map(({ id }) => id) } },
          orderBy: { productVariantId: 'asc' },
        });
        expect(inventories).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ onHand: 4, reserved: 1, version: 1 }),
            expect.objectContaining({ onHand: 4, reserved: 1, version: 1 }),
          ]),
        );
        await expect(
          prisma.auditLog.count({ where: { targetId: order.id } }),
        ).resolves.toBe(0);
      },
    );
  });

  it('rolls back order and audit when PostgreSQL rejects an inventory update', async () => {
    await withFixture(
      {
        status: OrderStatus.PROCESSING,
        variants: [
          {
            quantity: 1,
            onHand: 4,
            reserved: 1,
            version: 2_147_483_647,
          },
        ],
      },
      async ({ actor, order, variants }) => {
        await expect(
          transitionOrder(
            actor,
            order.id,
            'mark-ready-for-installation',
            order.version,
            'Force a real PostgreSQL update failure',
            `inventory-update-failure-${randomUUID()}`,
          ),
        ).rejects.toThrow();
        await expect(
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        ).resolves.toMatchObject({
          status: OrderStatus.PROCESSING,
          inventoryStatus: InventoryDisposition.RESERVED,
          version: order.version,
        });
        await expect(
          prisma.inventory.findUniqueOrThrow({
            where: { productVariantId: variants[0].id },
          }),
        ).resolves.toMatchObject({
          onHand: 4,
          reserved: 1,
          version: 2_147_483_647,
        });
        await expect(
          prisma.auditLog.count({ where: { targetId: order.id } }),
        ).resolves.toBe(0);
      },
    );
  });

  it('rejects stale versions and invalid current states without mutation', async () => {
    await withFixture(
      { status: OrderStatus.CONFIRMED },
      async ({ actor, order }) => {
        await expect(
          transitionOrder(
            actor,
            order.id,
            'confirm',
            order.version,
            'Wrong expected current state',
            `wrong-status-${randomUUID()}`,
          ),
        ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
        await expect(
          transitionOrder(
            actor,
            order.id,
            'start-processing',
            order.version + 1,
            'Stale expected version',
            `wrong-version-${randomUUID()}`,
          ),
        ).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' });
        await expect(
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        ).resolves.toMatchObject({
          status: OrderStatus.CONFIRMED,
          version: order.version,
        });
        await expect(
          prisma.auditLog.count({ where: { targetId: order.id } }),
        ).resolves.toBe(0);
      },
    );
  });

  it('requires paid payment to complete an order without installation', async () => {
    await withFixture(
      {
        status: OrderStatus.READY_FOR_INSTALLATION,
        inventoryStatus: InventoryDisposition.CONSUMED,
        paymentStatus: PaymentStatus.PENDING,
        variants: [{ quantity: 1, onHand: 4, reserved: 0 }],
      },
      async ({ actor, order }) => {
        await expect(
          transitionOrder(
            actor,
            order.id,
            'complete-without-installation',
            order.version,
            'Payment has not completed',
            `unpaid-completion-${randomUUID()}`,
          ),
        ).rejects.toMatchObject({
          code: 'INVALID_STATE_TRANSITION',
          message: 'PAYMENT_NOT_READY',
        });
        await prisma.payment.update({
          where: { orderId: order.id },
          data: { status: PaymentStatus.PAID, version: { increment: 1 } },
        });
        await expect(
          transitionOrder(
            actor,
            order.id,
            'complete-without-installation',
            order.version,
            'Payment completed',
            `paid-completion-${randomUUID()}`,
          ),
        ).resolves.toMatchObject({
          status: OrderStatus.COMPLETED,
          version: order.version + 1,
        });
      },
    );
  });

  it('rejects a transition from a terminal state', async () => {
    await withFixture(
      {
        status: OrderStatus.COMPLETED,
        inventoryStatus: InventoryDisposition.CONSUMED,
        paymentStatus: PaymentStatus.PAID,
        variants: [{ quantity: 1, onHand: 4, reserved: 0 }],
      },
      async ({ actor, order }) => {
        await expect(
          transitionOrder(
            actor,
            order.id,
            'confirm',
            order.version,
            'Terminal state cannot change',
            `terminal-${randomUUID()}`,
          ),
        ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
      },
    );
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
