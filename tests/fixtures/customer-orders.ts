import {
  AppointmentStatus,
  InventoryDisposition,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductCategory,
  ProductStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';

import { prisma } from '@/shared/db/client';

export const customerOrdersFixturePassword = 'OrdersE2EOnly-247Home';

function orderNumber(namespace: string, suffix: string) {
  return `247H-${namespace.slice(0, 12).toUpperCase()}-${suffix}`;
}

export async function cleanupCustomerOrdersFixtureNamespace(namespace: string) {
  const productSlug = `orders-e2e-${namespace}`;
  const serviceAreaCode = `ORD-${namespace}`;
  const orderPrefix = `247H-${namespace.slice(0, 12).toUpperCase()}-`;
  const userPrefix = `orders-e2e-${namespace}-`;

  await prisma.$transaction(async (tx) => {
    const fixtureOrders = await tx.order.findMany({
      where: { orderNumber: { startsWith: orderPrefix } },
      select: { id: true },
    });
    await tx.auditLog.deleteMany({
      where: {
        targetType: 'order',
        targetId: { in: fixtureOrders.map(({ id }) => id) },
      },
    });
    await tx.installationEvidence.deleteMany({
      where: {
        assignment: {
          appointment: { order: { orderNumber: { startsWith: orderPrefix } } },
        },
      },
    });
    await tx.technicianAssignment.deleteMany({
      where: {
        appointment: { order: { orderNumber: { startsWith: orderPrefix } } },
      },
    });
    await tx.installationAppointment.deleteMany({
      where: { order: { orderNumber: { startsWith: orderPrefix } } },
    });
    await tx.inventoryAllocation.deleteMany({
      where: {
        orderItem: { order: { orderNumber: { startsWith: orderPrefix } } },
      },
    });
    await tx.payment.deleteMany({
      where: { order: { orderNumber: { startsWith: orderPrefix } } },
    });
    await tx.orderItem.deleteMany({
      where: { order: { orderNumber: { startsWith: orderPrefix } } },
    });
    await tx.checkoutAttempt.deleteMany({
      where: { user: { email: { startsWith: userPrefix } } },
    });
    await tx.cart.deleteMany({
      where: { user: { email: { startsWith: userPrefix } } },
    });
    await tx.order.deleteMany({
      where: { orderNumber: { startsWith: orderPrefix } },
    });
    await tx.installationSlot.deleteMany({
      where: { serviceArea: { code: serviceAreaCode } },
    });
    await tx.serviceArea.deleteMany({ where: { code: serviceAreaCode } });
    await tx.inventory.deleteMany({
      where: { productVariant: { product: { slug: productSlug } } },
    });
    await tx.productVariant.deleteMany({
      where: { product: { slug: productSlug } },
    });
    await tx.product.deleteMany({ where: { slug: productSlug } });
    await tx.user.deleteMany({
      where: { email: { startsWith: userPrefix } },
    });
  });
}

export async function createCustomerOrdersFixture() {
  const namespace = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const ownerEmail = `orders-e2e-${namespace}-owner@example.test`;
  const intruderEmail = `orders-e2e-${namespace}-intruder@example.test`;
  const productSlug = `orders-e2e-${namespace}`;
  const serviceAreaCode = `ORD-${namespace}`;

  try {
    const customerRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'CUSTOMER' },
      select: { id: true },
    });
    const passwordHash = await hash(customerOrdersFixturePassword, 10);
    const [owner, intruder] = await Promise.all([
      prisma.user.create({
        data: {
          email: ownerEmail,
          name: 'Customer Orders Owner',
          passwordHash,
          roles: { create: { roleId: customerRole.id } },
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: intruderEmail,
          name: 'Customer Orders Intruder',
          passwordHash,
          roles: { create: { roleId: customerRole.id } },
        },
        select: { id: true },
      }),
    ]);
    const product = await prisma.product.create({
      data: {
        category: ProductCategory.SMART_LOCK,
        description: 'Customer order E2E fixture product.',
        name: 'Khóa cửa thông minh 247 Secure',
        slug: productSlug,
        status: ProductStatus.ACTIVE,
        variants: {
          create: {
            name: 'Màu đen tiêu chuẩn',
            priceVnd: 4_990_000n,
            sku: `ORD-${namespace}`,
          },
        },
      },
      select: { variants: { select: { id: true } } },
    });
    const variantId = product.variants[0].id;
    await prisma.inventory.create({
      data: { onHand: 20, productVariantId: variantId },
    });
    const serviceArea = await prisma.serviceArea.create({
      data: {
        code: serviceAreaCode,
        districtCode: `D-${namespace}`,
        districtName: 'Quận kiểm thử',
        installationFee: 300_000n,
        provinceCode: `P-${namespace}`,
        provinceName: 'Thành phố kiểm thử',
        shippingFee: 50_000n,
      },
      select: { id: true },
    });
    const scheduledStartAt = new Date(Date.now() + 72 * 60 * 60 * 1_000);
    const scheduledEndAt = new Date(
      scheduledStartAt.getTime() + 2 * 60 * 60 * 1_000,
    );
    const slot = await prisma.installationSlot.create({
      data: {
        bookedCount: 1,
        capacity: 2,
        endsAt: scheduledEndAt,
        serviceAreaId: serviceArea.id,
        startsAt: scheduledStartAt,
      },
      select: { id: true },
    });

    const tracked = await prisma.order.create({
      data: {
        addressLine1: '247 Đường Kiểm Thử',
        countryCode: 'VN',
        currency: 'VND',
        districtCode: `D-${namespace}`,
        districtName: 'Quận kiểm thử',
        grandTotal: 5_340_000n,
        idempotencyHash: `orders-e2e-${namespace}-tracked`,
        installationFee: 300_000n,
        inventoryStatus: InventoryDisposition.CONSUMED,
        orderNumber: orderNumber(namespace, 'TRACKED'),
        postalCode: null,
        provinceCode: `P-${namespace}`,
        provinceName: 'Thành phố kiểm thử',
        recipientName: 'Customer Orders Owner',
        recipientPhone: '0900000000',
        requestFingerprint: `orders-e2e-${namespace}-tracked`,
        serviceAreaId: serviceArea.id,
        shippingFee: 50_000n,
        status: OrderStatus.READY_FOR_INSTALLATION,
        subtotal: 4_990_000n,
        userId: owner.id,
        wardName: 'Phường kiểm thử',
        appointment: {
          create: {
            scheduledEndAt,
            scheduledStartAt,
            serviceAreaId: serviceArea.id,
            slotId: slot.id,
            status: AppointmentStatus.ASSIGNMENT_PENDING,
          },
        },
        items: {
          create: {
            deviceUnitPrice: 4_990_000n,
            lineTotal: 4_990_000n,
            productName: 'Khóa cửa thông minh 247 Secure',
            productVariantId: variantId,
            quantity: 1,
            serviceUnitPrice: 0n,
            sku: `ORD-${namespace}`,
            unitPrice: 4_990_000n,
            variantName: 'Màu đen tiêu chuẩn',
          },
        },
        payment: {
          create: {
            amount: 5_340_000n,
            method: PaymentMethod.BANK_TRANSFER,
            referenceCode: `PAY-${namespace}-TRACKED`,
            status: PaymentStatus.PAID,
          },
        },
      },
      select: { id: true, orderNumber: true },
    });

    const cancellableStartAt = new Date(Date.now() + 96 * 60 * 60 * 1_000);
    const cancellableEndAt = new Date(
      cancellableStartAt.getTime() + 2 * 60 * 60 * 1_000,
    );
    const cancellableSlot = await prisma.installationSlot.create({
      data: {
        bookedCount: 1,
        capacity: 1,
        endsAt: cancellableEndAt,
        serviceAreaId: serviceArea.id,
        startsAt: cancellableStartAt,
      },
      select: { id: true },
    });
    const cancellable = await prisma.order.create({
      data: {
        addressLine1: '247 ÄÆ°á»ng há»§y Ä‘Æ¡n kiá»ƒm thá»­',
        countryCode: 'VN',
        currency: 'VND',
        districtCode: `D-${namespace}`,
        districtName: 'Quáº­n kiá»ƒm thá»­',
        grandTotal: 5_340_000n,
        idempotencyHash: `orders-e2e-${namespace}-cancellable`,
        installationFee: 300_000n,
        inventoryStatus: InventoryDisposition.RESERVED,
        orderNumber: orderNumber(namespace, 'CANCELLABLE'),
        provinceCode: `P-${namespace}`,
        provinceName: 'ThÃ nh phá»‘ kiá»ƒm thá»­',
        recipientName: 'Customer Orders Owner',
        recipientPhone: '0900000000',
        requestFingerprint: `orders-e2e-${namespace}-cancellable`,
        serviceAreaId: serviceArea.id,
        shippingFee: 50_000n,
        status: OrderStatus.PENDING_CONFIRMATION,
        subtotal: 4_990_000n,
        userId: owner.id,
        wardName: 'PhÆ°á»ng kiá»ƒm thá»­',
        appointment: {
          create: {
            scheduledEndAt: cancellableEndAt,
            scheduledStartAt: cancellableStartAt,
            serviceAreaId: serviceArea.id,
            slotId: cancellableSlot.id,
            status: AppointmentStatus.ASSIGNMENT_PENDING,
          },
        },
        items: {
          create: {
            deviceUnitPrice: 4_990_000n,
            lineTotal: 4_990_000n,
            productName: 'KhÃ³a cá»­a thÃ´ng minh 247 Secure',
            productVariantId: variantId,
            quantity: 1,
            serviceUnitPrice: 0n,
            sku: `ORD-${namespace}`,
            unitPrice: 4_990_000n,
            variantName: 'MÃ u Ä‘en tiÃªu chuáº©n',
          },
        },
        payment: {
          create: {
            amount: 5_340_000n,
            method: PaymentMethod.COD,
            referenceCode: `PAY-${namespace}-CANCELLABLE`,
            status: PaymentStatus.PENDING,
          },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        items: { select: { id: true, productVariantId: true, quantity: true } },
      },
    });
    await prisma.$transaction(async (tx) => {
      await tx.inventory.update({
        where: { productVariantId: variantId },
        data: { reserved: { increment: 1 }, version: { increment: 1 } },
      });
      await tx.inventoryAllocation.create({
        data: {
          orderItemId: cancellable.items[0].id,
          productVariantId: cancellable.items[0].productVariantId,
          quantity: cancellable.items[0].quantity,
          status: InventoryDisposition.RESERVED,
        },
      });
    });

    const secondaryStatuses = [
      OrderStatus.PROCESSING,
      OrderStatus.CONFIRMED,
      OrderStatus.PENDING_CONFIRMATION,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ] as const;
    const secondaryOrders: Array<{ id: string; orderNumber: string }> = [];
    for (const [index, status] of secondaryStatuses.entries()) {
      const total = BigInt(2_000_000 + index * 100_000);
      const created = await prisma.order.create({
        data: {
          addressLine1: `${index + 1} Đường Kiểm Thử`,
          cancelledAt:
            status === OrderStatus.CANCELLED ? new Date() : undefined,
          completedAt:
            status === OrderStatus.COMPLETED ? new Date() : undefined,
          countryCode: 'VN',
          createdAt: new Date(Date.now() - (index + 1) * 60_000),
          currency: 'VND',
          districtCode: `D-${namespace}`,
          districtName: 'Quận kiểm thử',
          grandTotal: total,
          idempotencyHash: `orders-e2e-${namespace}-${index}`,
          installationFee: 0n,
          inventoryStatus:
            status === OrderStatus.COMPLETED
              ? InventoryDisposition.CONSUMED
              : status === OrderStatus.CANCELLED
                ? InventoryDisposition.RELEASED
                : InventoryDisposition.RESERVED,
          orderNumber: orderNumber(namespace, `HISTORY-${index}`),
          provinceCode: `P-${namespace}`,
          provinceName: 'Thành phố kiểm thử',
          recipientName: 'Customer Orders Owner',
          recipientPhone: '0900000000',
          requestFingerprint: `orders-e2e-${namespace}-${index}`,
          serviceAreaId: serviceArea.id,
          shippingFee: 0n,
          status,
          subtotal: total,
          userId: owner.id,
          wardName: 'Phường kiểm thử',
          items: {
            create: {
              deviceUnitPrice: total,
              lineTotal: total,
              productName: 'Khóa cửa thông minh 247 Secure',
              productVariantId: variantId,
              quantity: 1,
              serviceUnitPrice: 0n,
              sku: `ORD-${namespace}`,
              unitPrice: total,
              variantName: 'Màu đen tiêu chuẩn',
            },
          },
          payment: {
            create: {
              amount: total,
              method: PaymentMethod.COD,
              referenceCode: `PAY-${namespace}-${index}`,
              status:
                status === OrderStatus.PENDING_CONFIRMATION
                  ? PaymentStatus.PENDING
                  : PaymentStatus.PAID,
            },
          },
        },
        select: { id: true, orderNumber: true },
      });
      secondaryOrders.push(created);
    }

    const foreign = await prisma.order.create({
      data: {
        addressLine1: 'Địa chỉ riêng của khách hàng khác',
        countryCode: 'VN',
        currency: 'VND',
        districtCode: `D-${namespace}`,
        districtName: 'Quận kiểm thử',
        grandTotal: 7_700_000n,
        idempotencyHash: `orders-e2e-${namespace}-foreign`,
        installationFee: 0n,
        orderNumber: orderNumber(namespace, 'FOREIGN'),
        provinceCode: `P-${namespace}`,
        provinceName: 'Thành phố kiểm thử',
        recipientName: 'Customer Orders Intruder',
        recipientPhone: '0911111111',
        requestFingerprint: `orders-e2e-${namespace}-foreign`,
        serviceAreaId: serviceArea.id,
        shippingFee: 0n,
        status: OrderStatus.CONFIRMED,
        subtotal: 7_700_000n,
        userId: intruder.id,
        wardName: 'Phường kiểm thử',
        items: {
          create: {
            deviceUnitPrice: 7_700_000n,
            lineTotal: 7_700_000n,
            productName: 'Sản phẩm riêng tư của khách khác',
            productVariantId: variantId,
            quantity: 1,
            serviceUnitPrice: 0n,
            sku: `ORD-${namespace}`,
            unitPrice: 7_700_000n,
            variantName: 'Không được tiết lộ',
          },
        },
        payment: {
          create: {
            amount: 7_700_000n,
            method: PaymentMethod.COD,
            referenceCode: `PAY-${namespace}-FOREIGN`,
            status: PaymentStatus.PAID,
          },
        },
      },
      select: { id: true, orderNumber: true },
    });

    return {
      cleanup: () => cleanupCustomerOrdersFixtureNamespace(namespace),
      namespace,
      variantId,
      orders: { cancellable, foreign, secondary: secondaryOrders, tracked },
      owner: { email: ownerEmail, id: owner.id },
      intruder: { email: intruderEmail, id: intruder.id },
      productName: 'Khóa cửa thông minh 247 Secure',
    };
  } catch (error) {
    await cleanupCustomerOrdersFixtureNamespace(namespace);
    throw error;
  }
}
