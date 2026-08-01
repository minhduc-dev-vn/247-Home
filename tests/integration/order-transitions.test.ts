import { randomUUID } from 'node:crypto';

import {
  AppointmentStatus,
  InventoryDisposition,
  OrderStatus,
  PaymentMethod,
  PaymentSessionStatus,
  PaymentStatus,
  ProductCategory,
  type Product,
  type ProductVariant,
} from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { expireUnpaidOrders, transitionOrder } from '@/modules/commerce';
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
  withAppointment?: boolean;
  appointmentStatus?: AppointmentStatus;
  slotBookedCount?: number;
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
  const scheduledStartAt = new Date(Date.now() + 72 * 60 * 60 * 1_000);
  const scheduledEndAt = new Date(
    scheduledStartAt.getTime() + 2 * 60 * 60 * 1_000,
  );
  const serviceArea = options.withAppointment
    ? await prisma.serviceArea.create({
        data: {
          code: `ORDER-TRANSITION-${namespace}`,
          districtCode: `DISTRICT-${namespace}`,
          districtName: 'Order transition district',
          installationFee: 0,
          provinceCode: `PROVINCE-${namespace}`,
          provinceName: 'Order transition province',
          shippingFee: 0,
        },
        select: { id: true },
      })
    : null;
  const slot = serviceArea
    ? await prisma.installationSlot.create({
        data: {
          serviceAreaId: serviceArea.id,
          startsAt: scheduledStartAt,
          endsAt: scheduledEndAt,
          capacity: 2,
          bookedCount: options.slotBookedCount ?? 1,
        },
        select: { id: true },
      })
    : null;
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
      serviceAreaId: serviceArea?.id,
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
      ...(serviceArea && slot
        ? {
            appointment: {
              create: {
                serviceAreaId: serviceArea.id,
                slotId: slot.id,
                status:
                  options.appointmentStatus ??
                  AppointmentStatus.ASSIGNMENT_PENDING,
                scheduledStartAt,
                scheduledEndAt,
              },
            },
          }
        : {}),
    },
    include: {
      items: { select: { id: true, productVariantId: true, quantity: true } },
      appointment: { select: { id: true, status: true, version: true } },
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
    customer,
    order,
    serviceArea,
    slot,
    variants,
    async cleanup() {
      await prisma.auditLog.deleteMany({ where: { targetId: order.id } });
      await prisma.installationEvidence.deleteMany({
        where: { assignment: { appointment: { orderId: order.id } } },
      });
      await prisma.technicianAssignment.deleteMany({
        where: { appointment: { orderId: order.id } },
      });
      await prisma.installationAppointment.deleteMany({
        where: { orderId: order.id },
      });
      await prisma.paymentWebhookEvent.deleteMany({
        where: { payment: { orderId: order.id } },
      });
      await prisma.paymentSession.deleteMany({
        where: { payment: { orderId: order.id } },
      });
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.inventoryAllocation.deleteMany({
        where: { orderItemId: { in: order.items.map(({ id }) => id) } },
      });
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
      if (slot)
        await prisma.installationSlot.delete({ where: { id: slot.id } });
      if (serviceArea)
        await prisma.serviceArea.delete({ where: { id: serviceArea.id } });
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
        // Supplied on purpose: the handler must ignore these and mint its own
        // identifier, so they must never reach the audit trail.
        const clientRequestIds = [
          `confirm-a-${randomUUID()}`,
          `confirm-b-${randomUUID()}`,
        ];
        const responses = await Promise.all(
          clientRequestIds.map((clientRequestId, index) =>
            withApiHandler(
              new Request('http://localhost/api/v1/admin/orders/actions', {
                headers: { 'x-request-id': clientRequestId },
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

        const successRequestId = success?.headers.get('X-Request-Id');
        const conflictRequestId = conflict?.headers.get('X-Request-Id');
        expect(successRequestId).toMatch(/^req_/);
        expect(conflictRequestId).toMatch(/^req_/);
        expect(successRequestId).not.toBe(conflictRequestId);

        const auditRows = await prisma.auditLog.findMany({
          where: { targetId: order.id },
          select: { requestId: true, action: true },
        });
        expect(auditRows).toEqual([
          { requestId: successRequestId, action: 'order.confirm' },
        ]);
        expect(auditRows.map(({ requestId }) => requestId)).not.toContain(
          conflictRequestId,
        );
        for (const clientRequestId of clientRequestIds) {
          expect(auditRows.map(({ requestId }) => requestId)).not.toContain(
            clientRequestId,
          );
        }
      },
    );
  });

  it('releases reserved inventory, appointment capacity, and unpaid payment in one cancellation transaction', async () => {
    await withFixture(
      { status: OrderStatus.PENDING_CONFIRMATION, withAppointment: true },
      async ({ actor, order, slot, variants }) => {
        expect(slot).not.toBeNull();
        await expect(
          transitionOrder(
            actor,
            order.id,
            'cancel',
            order.version,
            'Customer requested cancellation',
            `cancel-${randomUUID()}`,
          ),
        ).resolves.toMatchObject({
          status: OrderStatus.CANCELLED,
          inventoryStatus: InventoryDisposition.RELEASED,
          version: order.version + 1,
          cancellationReason: 'Customer requested cancellation',
        });

        const [
          updatedOrder,
          inventory,
          allocation,
          appointment,
          updatedSlot,
          payment,
          audits,
        ] = await Promise.all([
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
          prisma.inventory.findUniqueOrThrow({
            where: { productVariantId: variants[0].id },
          }),
          prisma.inventoryAllocation.findUniqueOrThrow({
            where: { orderItemId: order.items[0].id },
          }),
          prisma.installationAppointment.findUniqueOrThrow({
            where: { orderId: order.id },
          }),
          prisma.installationSlot.findUniqueOrThrow({
            where: { id: slot!.id },
          }),
          prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } }),
          prisma.auditLog.findMany({
            where: { targetId: order.id },
            select: { action: true, actorUserId: true, reason: true },
          }),
        ]);
        expect(updatedOrder).toMatchObject({
          status: OrderStatus.CANCELLED,
          inventoryStatus: InventoryDisposition.RELEASED,
          version: order.version + 1,
          cancelledAt: expect.any(Date),
        });
        expect(inventory).toMatchObject({ onHand: 5, reserved: 0, version: 2 });
        expect(allocation).toMatchObject({
          status: InventoryDisposition.RELEASED,
          releasedAt: expect.any(Date),
          consumedAt: null,
        });
        expect(appointment).toMatchObject({
          status: AppointmentStatus.CANCELLED,
          capacityReleasedAt: expect.any(Date),
          version: 2,
        });
        expect(updatedSlot).toMatchObject({ bookedCount: 0, version: 2 });
        expect(payment).toMatchObject({
          status: PaymentStatus.CANCELLED,
          cancelledAt: expect.any(Date),
          version: 2,
        });
        expect(audits).toEqual([
          {
            action: 'order.cancel',
            actorUserId: actor.userId,
            reason: 'Customer requested cancellation',
          },
        ]);
      },
    );
  });

  it('allows exactly one concurrent cancellation and releases every resource once', async () => {
    await withFixture(
      { status: OrderStatus.PENDING_CONFIRMATION, withAppointment: true },
      async ({ actor, order, slot, variants }) => {
        const results = await Promise.all(
          ['a', 'b'].map(async (suffix) => {
            try {
              await transitionOrder(
                actor,
                order.id,
                'cancel',
                order.version,
                `Concurrent cancellation ${suffix}`,
                `cancel-${suffix}-${randomUUID()}`,
              );
              return 'success' as const;
            } catch (error) {
              return error;
            }
          }),
        );
        expect(results.filter((result) => result === 'success')).toHaveLength(
          1,
        );
        expect(results.find((result) => result !== 'success')).toMatchObject({
          code: 'CONCURRENT_MODIFICATION',
        });
        await expect(
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        ).resolves.toMatchObject({
          status: OrderStatus.CANCELLED,
          version: order.version + 1,
          inventoryStatus: InventoryDisposition.RELEASED,
        });
        await expect(
          prisma.inventory.findUniqueOrThrow({
            where: { productVariantId: variants[0].id },
          }),
        ).resolves.toMatchObject({ onHand: 5, reserved: 0, version: 2 });
        await expect(
          prisma.installationSlot.findUniqueOrThrow({
            where: { id: slot!.id },
          }),
        ).resolves.toMatchObject({ bookedCount: 0, version: 2 });
        await expect(
          prisma.inventoryAllocation.count({
            where: {
              orderItemId: order.items[0].id,
              status: InventoryDisposition.RELEASED,
            },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.auditLog.count({
            where: { targetId: order.id, action: 'order.cancel' },
          }),
        ).resolves.toBe(1);
      },
    );
  });

  it('rolls back cancellation when a reservation is incomplete', async () => {
    await withFixture(
      { status: OrderStatus.PENDING_CONFIRMATION, withAppointment: true },
      async ({ actor, order, slot, variants }) => {
        await prisma.inventoryAllocation.delete({
          where: { orderItemId: order.items[0].id },
        });
        await expect(
          transitionOrder(
            actor,
            order.id,
            'cancel',
            order.version,
            'Reservation is missing',
            `cancel-missing-reservation-${randomUUID()}`,
          ),
        ).rejects.toMatchObject({ code: 'INVENTORY_CONFLICT' });
        await expect(
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        ).resolves.toMatchObject({
          status: OrderStatus.PENDING_CONFIRMATION,
          inventoryStatus: InventoryDisposition.RESERVED,
          version: order.version,
        });
        await expect(
          prisma.inventory.findUniqueOrThrow({
            where: { productVariantId: variants[0].id },
          }),
        ).resolves.toMatchObject({ onHand: 5, reserved: 1, version: 1 });
        await expect(
          prisma.installationAppointment.findUniqueOrThrow({
            where: { orderId: order.id },
          }),
        ).resolves.toMatchObject({
          status: AppointmentStatus.ASSIGNMENT_PENDING,
          capacityReleasedAt: null,
          version: 1,
        });
        await expect(
          prisma.installationSlot.findUniqueOrThrow({
            where: { id: slot!.id },
          }),
        ).resolves.toMatchObject({ bookedCount: 1, version: 1 });
        await expect(
          prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } }),
        ).resolves.toMatchObject({ status: PaymentStatus.PENDING, version: 1 });
        await expect(
          prisma.auditLog.count({ where: { targetId: order.id } }),
        ).resolves.toBe(0);
      },
    );
  });

  it('rolls back every cancellation side effect when audit persistence fails', async () => {
    await withFixture(
      { status: OrderStatus.PENDING_CONFIRMATION, withAppointment: true },
      async ({ actor, order, slot, variants }) => {
        await prisma.user.delete({ where: { id: actor.userId } });
        await expect(
          transitionOrder(
            actor,
            order.id,
            'cancel',
            order.version,
            'Audit persistence failure rollback',
            `cancel-audit-failure-${randomUUID()}`,
          ),
        ).rejects.toThrow();
        await expect(
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        ).resolves.toMatchObject({
          status: OrderStatus.PENDING_CONFIRMATION,
          inventoryStatus: InventoryDisposition.RESERVED,
          version: order.version,
        });
        await expect(
          prisma.inventory.findUniqueOrThrow({
            where: { productVariantId: variants[0].id },
          }),
        ).resolves.toMatchObject({ onHand: 5, reserved: 1, version: 1 });
        await expect(
          prisma.installationAppointment.findUniqueOrThrow({
            where: { orderId: order.id },
          }),
        ).resolves.toMatchObject({
          status: AppointmentStatus.ASSIGNMENT_PENDING,
          capacityReleasedAt: null,
          version: 1,
        });
        await expect(
          prisma.installationSlot.findUniqueOrThrow({
            where: { id: slot!.id },
          }),
        ).resolves.toMatchObject({ bookedCount: 1, version: 1 });
        await expect(
          prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } }),
        ).resolves.toMatchObject({ status: PaymentStatus.PENDING, version: 1 });
        await expect(
          prisma.auditLog.count({ where: { targetId: order.id } }),
        ).resolves.toBe(0);
      },
    );
  });

  it('expires only a bounded set of old unpaid orders through the approved maintenance action', async () => {
    await withFixture(
      { status: OrderStatus.PENDING_CONFIRMATION, withAppointment: true },
      async ({ actor, order }) => {
        await expect(
          expireUnpaidOrders(actor, {
            before: new Date(Date.now() + 1_000),
            limit: 1,
            reason: 'Approved maintenance expiry',
          }),
        ).resolves.toEqual({ candidates: 1, expired: 1, skipped: 0 });
        await expect(
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        ).resolves.toMatchObject({
          status: OrderStatus.CANCELLED,
          inventoryStatus: InventoryDisposition.RELEASED,
        });
        await expect(
          prisma.auditLog.count({
            where: { targetId: order.id, action: 'order.expire' },
          }),
        ).resolves.toBe(1);
        await expect(
          expireUnpaidOrders(actor, {
            before: new Date(Date.now() + 1_000),
            limit: 1,
            reason: 'Approved maintenance retry',
          }),
        ).resolves.toEqual({ candidates: 0, expired: 0, skipped: 0 });
      },
    );
  });

  it('does not release a paid order through the unpaid cancellation path', async () => {
    await withFixture(
      {
        status: OrderStatus.PENDING_CONFIRMATION,
        paymentStatus: PaymentStatus.PAID,
        withAppointment: true,
      },
      async ({ actor, order, slot, variants }) => {
        await expect(
          transitionOrder(
            actor,
            order.id,
            'cancel',
            order.version,
            'Attempt to cancel paid order',
            `paid-cancel-${randomUUID()}`,
          ),
        ).rejects.toMatchObject({
          code: 'INVALID_STATE_TRANSITION',
          message: 'PAYMENT_NOT_READY',
        });
        await expect(
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        ).resolves.toMatchObject({
          status: OrderStatus.PENDING_CONFIRMATION,
          inventoryStatus: InventoryDisposition.RESERVED,
          version: order.version,
        });
        await expect(
          prisma.inventory.findUniqueOrThrow({
            where: { productVariantId: variants[0].id },
          }),
        ).resolves.toMatchObject({ onHand: 5, reserved: 1, version: 1 });
        await expect(
          prisma.installationSlot.findUniqueOrThrow({
            where: { id: slot!.id },
          }),
        ).resolves.toMatchObject({ bookedCount: 1, version: 1 });
        await expect(
          prisma.auditLog.count({ where: { targetId: order.id } }),
        ).resolves.toBe(0);
      },
    );
  });

  it('does not cancel an order while an online payment session is still payable', async () => {
    await withFixture(
      {
        status: OrderStatus.PENDING_CONFIRMATION,
        paymentMethod: PaymentMethod.VNPAY,
        withAppointment: true,
      },
      async ({ actor, order, variants }) => {
        const payment = await prisma.payment.findUniqueOrThrow({
          where: { orderId: order.id },
          select: { id: true },
        });
        await prisma.paymentSession.create({
          data: {
            paymentId: payment.id,
            provider: PaymentMethod.VNPAY,
            providerReference: `VNPAY-${randomUUID()}`,
            idempotencyHash: `session-${randomUUID()}`,
            requestFingerprint: `session-${randomUUID()}`,
            status: PaymentSessionStatus.CREATED,
            expiresAt: new Date(Date.now() + 15 * 60 * 1_000),
          },
        });
        await expect(
          transitionOrder(
            actor,
            order.id,
            'cancel',
            order.version,
            'Attempt while online payment remains active',
            `active-session-${randomUUID()}`,
          ),
        ).rejects.toMatchObject({
          code: 'INVALID_STATE_TRANSITION',
          message: 'PAYMENT_NOT_READY',
        });
        await expect(
          prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        ).resolves.toMatchObject({
          status: OrderStatus.PENDING_CONFIRMATION,
          inventoryStatus: InventoryDisposition.RESERVED,
          version: order.version,
        });
        await expect(
          prisma.inventory.findUniqueOrThrow({
            where: { productVariantId: variants[0].id },
          }),
        ).resolves.toMatchObject({ onHand: 5, reserved: 1, version: 1 });
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
