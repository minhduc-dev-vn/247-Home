import { createHash, randomUUID } from 'node:crypto';

import {
  AppointmentStatus,
  CartStatus,
  InventoryDisposition,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { CatalogError } from '@/modules/catalog';
import { lockInventory } from '@/modules/catalog/infrastructure/inventory-repository';
import {
  authorizeOrderActor,
  decideOrderTransition,
  orderActionLabels,
  orderActions,
  type OrderAction,
  type OrderTransitionDecision,
} from '@/modules/commerce/domain/order-transition';
import {
  decidePaymentTransition,
  paymentActionLabels,
  paymentActions,
  type PaymentAction,
} from '@/modules/commerce/domain/payment-transition';
import {
  claimCheckoutAttempt,
  lockActiveCart,
  lockCheckoutSlot,
  lockDefaultAddressScope,
} from '@/modules/commerce/infrastructure/checkout-repository';
import {
  lockOrder,
  lockPayment,
} from '@/modules/commerce/infrastructure/order-repository';
import {
  type AddressInput,
  type AddressListQuery,
  type CartItemInput,
  type CheckoutInput,
  type QuoteInput,
  type OrderListQuery,
  type SlotQuery,
} from '@/modules/commerce/presentation/schemas';
import { actorHasRole, type IdentityActor } from '@/modules/identity';
import { prisma } from '@/shared/db/client';

const customerRoles = ['CUSTOMER'] as const;

function requireCustomer(actor: IdentityActor | null) {
  if (!actor) throw new CatalogError('UNAUTHENTICATED');
  if (!actorHasRole(actor, customerRoles)) throw new CatalogError('FORBIDDEN');
  return actor;
}

function money(value: bigint) {
  return value.toString();
}
function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function orderNumber() {
  return `247H-${new Date().getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}
function paymentReference() {
  return `PAY-${randomUUID().replaceAll('-', '').slice(0, 14).toUpperCase()}`;
}

async function activeCart(userId: string) {
  const found = await prisma.cart.findFirst({
    where: { userId, status: CartStatus.ACTIVE },
    select: { id: true },
  });
  if (found) return found;
  try {
    return await prisma.cart.create({ data: { userId } });
  } catch {
    return prisma.cart.findFirstOrThrow({
      where: { userId, status: CartStatus.ACTIVE },
      select: { id: true },
    });
  }
}

const cartSelect = {
  id: true,
  status: true,
  version: true,
  items: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      servicePackageId: true,
      quantity: true,
      productVariant: {
        select: {
          id: true,
          sku: true,
          name: true,
          priceVnd: true,
          warrantyMonths: true,
          isActive: true,
          product: { select: { name: true, status: true } },
          inventory: { select: { onHand: true, reserved: true } },
        },
      },
      servicePackage: {
        select: {
          id: true,
          name: true,
          priceVnd: true,
          isActive: true,
          productVariantId: true,
        },
      },
    },
  },
} satisfies Prisma.CartSelect;

function cartDto(cart: Prisma.CartGetPayload<{ select: typeof cartSelect }>) {
  return {
    id: cart.id,
    status: cart.status,
    version: cart.version,
    items: cart.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      productVariantId: item.productVariant.id,
      name: `${item.productVariant.product.name} - ${item.productVariant.name}`,
      servicePackageId: item.servicePackage?.id ?? null,
      servicePackageName: item.servicePackage?.name ?? null,
      deviceUnitPrice: money(item.productVariant.priceVnd),
      serviceUnitPrice: money(item.servicePackage?.priceVnd ?? 0n),
      availability:
        item.productVariant.inventory &&
        item.productVariant.inventory.onHand >
          item.productVariant.inventory.reserved
          ? 'AVAILABLE'
          : 'UNAVAILABLE',
    })),
  };
}

export async function getCart(actor: IdentityActor | null) {
  const customer = requireCustomer(actor);
  const cart = await activeCart(customer.userId);
  return cartDto(
    await prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      select: cartSelect,
    }),
  );
}
export async function addCartItem(
  actor: IdentityActor | null,
  input: CartItemInput,
) {
  const customer = requireCustomer(actor);
  const cart = await activeCart(customer.userId);
  const variant = await prisma.productVariant.findFirst({
    where: {
      id: input.productVariantId,
      isActive: true,
      product: { status: 'ACTIVE' },
    },
    select: { id: true },
  });
  if (!variant) throw new CatalogError('NOT_FOUND');
  if (input.servicePackageId) {
    const pkg = await prisma.servicePackage.findFirst({
      where: {
        id: input.servicePackageId,
        productVariantId: variant.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!pkg)
      throw new CatalogError('CONFLICT', 'Goi lap dat khong tuong thich.');
  }
  const existing = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productVariantId: variant.id,
      servicePackageId: input.servicePackageId ?? null,
    },
    select: { id: true },
  });
  if (existing) {
    const updated = await prisma.cartItem.updateMany({
      where: {
        id: existing.id,
        quantity: { lte: 99 - input.quantity },
      },
      data: { quantity: { increment: input.quantity } },
    });
    if (updated.count !== 1)
      throw new CatalogError('CONFLICT', 'CART_QUANTITY_LIMIT');
  } else
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productVariantId: variant.id,
        servicePackageId: input.servicePackageId ?? null,
        quantity: input.quantity,
      },
    });
  return getCart(customer);
}
export async function updateCartItem(
  actor: IdentityActor | null,
  itemId: string,
  quantity: number,
) {
  const customer = requireCustomer(actor);
  const item = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cart: { userId: customer.userId, status: CartStatus.ACTIVE },
    },
    select: { id: true },
  });
  if (!item) throw new CatalogError('NOT_FOUND');
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return getCart(customer);
}
export async function removeCartItem(
  actor: IdentityActor | null,
  itemId: string,
) {
  const customer = requireCustomer(actor);
  const removed = await prisma.cartItem.deleteMany({
    where: {
      id: itemId,
      cart: { userId: customer.userId, status: CartStatus.ACTIVE },
    },
  });
  if (!removed.count) throw new CatalogError('NOT_FOUND');
  return getCart(customer);
}

export async function createAddress(
  actor: IdentityActor | null,
  input: AddressInput,
) {
  const customer = requireCustomer(actor);
  const area = await prisma.serviceArea.findFirst({
    where: {
      provinceCode: input.provinceCode,
      districtCode: input.districtCode,
      isActive: true,
    },
    select: { id: true },
  });
  return prisma.$transaction(async (transaction) => {
    if (input.isDefault) {
      await lockDefaultAddressScope(transaction, customer.userId);
      await transaction.address.updateMany({
        where: { userId: customer.userId, archivedAt: null, isDefault: true },
        data: { isDefault: false },
      });
    }
    return transaction.address.create({
      data: {
        ...input,
        line2: input.line2 ?? null,
        postalCode: input.postalCode ?? null,
        userId: customer.userId,
        serviceAreaId: area?.id ?? null,
      },
    });
  });
}
export async function listAddresses(
  actor: IdentityActor | null,
  input: AddressListQuery = { limit: 25 },
) {
  const customer = requireCustomer(actor);
  const rows = await prisma.address.findMany({
    where: { userId: customer.userId, archivedAt: null },
    select: {
      id: true,
      recipientName: true,
      line1: true,
      wardName: true,
      districtCode: true,
      districtName: true,
      provinceCode: true,
      provinceName: true,
      isDefault: true,
      serviceAreaId: true,
      createdAt: true,
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
  });
  const hasNext = rows.length > input.limit;
  const items = rows
    .slice(0, input.limit)
    .map(({ createdAt: _createdAt, ...row }) => row);
  return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
}

async function buildQuote(
  transaction: Prisma.TransactionClient,
  userId: string,
  input: QuoteInput,
) {
  const cart = await transaction.cart.findFirst({
    where: {
      id: (input as QuoteInput & { cartId?: string }).cartId,
      userId,
      status: CartStatus.ACTIVE,
    },
    select: cartSelect,
  });
  if (!cart || !cart.items.length) throw new CatalogError('CART_EMPTY');
  const address = await transaction.address.findFirst({
    where: { id: input.addressId, userId, archivedAt: null },
    select: {
      recipientName: true,
      phone: true,
      line1: true,
      line2: true,
      wardName: true,
      districtCode: true,
      districtName: true,
      provinceCode: true,
      provinceName: true,
      postalCode: true,
      countryCode: true,
    },
  });
  if (!address) throw new CatalogError('NOT_FOUND');
  const requiresInstallation = cart.items.some(
    (item) => item.servicePackageId !== null,
  );
  const area = await transaction.serviceArea.findFirst({
    where: {
      provinceCode: address.provinceCode,
      districtCode: address.districtCode,
      isActive: true,
    },
    select: { id: true, installationFee: true, shippingFee: true },
  });
  if (requiresInstallation && !area)
    throw new CatalogError('SERVICE_AREA_UNSUPPORTED');
  const lines = cart.items.map((item) => {
    if (
      !item.productVariant.isActive ||
      item.productVariant.product.status !== 'ACTIVE' ||
      (item.servicePackage &&
        (!item.servicePackage.isActive ||
          item.servicePackage.productVariantId !== item.productVariant.id))
    )
      throw new CatalogError('CONFLICT');
    const device = item.productVariant.priceVnd;
    const service = item.servicePackage?.priceVnd ?? 0n;
    return {
      item,
      device,
      service,
      unit: device + service,
      total: (device + service) * BigInt(item.quantity),
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0n);
  const installationFee = requiresInstallation ? area!.installationFee : 0n;
  const shippingFee = area?.shippingFee ?? 0n;
  return {
    cart,
    address,
    area,
    requiresInstallation,
    lines,
    subtotal,
    installationFee,
    shippingFee,
    grandTotal: subtotal + installationFee + shippingFee,
  };
}

export async function quoteCart(
  actor: IdentityActor | null,
  input: QuoteInput & { cartId?: string },
) {
  const customer = requireCustomer(actor);
  const cart = input.cartId
    ? await prisma.cart.findFirst({
        where: { id: input.cartId, userId: customer.userId },
        select: { id: true },
      })
    : await activeCart(customer.userId);
  if (!cart) throw new CatalogError('NOT_FOUND');
  const quote = await buildQuote(prisma, customer.userId, {
    ...input,
    cartId: cart.id,
  } as QuoteInput);
  return {
    cartId: quote.cart.id,
    items: quote.lines.map(({ item, device, service, unit, total }) => ({
      cartItemId: item.id,
      productVariantId: item.productVariant.id,
      quantity: item.quantity,
      deviceUnitPrice: money(device),
      serviceUnitPrice: money(service),
      unitPrice: money(unit),
      lineTotal: money(total),
    })),
    subtotal: money(quote.subtotal),
    installationFee: money(quote.installationFee),
    shippingFee: money(quote.shippingFee),
    discountTotal: '0',
    grandTotal: money(quote.grandTotal),
    currency: 'VND',
  };
}

export async function checkout(
  actor: IdentityActor | null,
  input: CheckoutInput,
  idempotencyKey: string,
  requestId: string,
) {
  const customer = requireCustomer(actor);
  const keyHash = hash(idempotencyKey);
  const fingerprint = hash(
    JSON.stringify({
      cartId: input.cartId,
      addressId: input.addressId,
      paymentMethod: input.paymentMethod,
      slotId: input.slotId ?? null,
    }),
  );
  return prisma.$transaction(async (transaction) => {
    const attemptId = await claimCheckoutAttempt(transaction, {
      id: randomUUID().replaceAll('-', ''),
      userId: customer.userId,
      idempotencyHash: keyHash,
      requestFingerprint: fingerprint,
    });
    if (!attemptId) {
      const attempt = await transaction.checkoutAttempt.findUniqueOrThrow({
        where: {
          userId_idempotencyHash: {
            userId: customer.userId,
            idempotencyHash: keyHash,
          },
        },
        include: { order: { include: { payment: true } } },
      });
      if (attempt.requestFingerprint !== fingerprint)
        throw new CatalogError('IDEMPOTENCY_CONFLICT');
      if (!attempt.order || !attempt.order.payment)
        throw new CatalogError('CONFLICT');
      return { replayed: true, order: attempt.order };
    }
    if (!(await lockActiveCart(transaction, input.cartId, customer.userId)))
      throw new CatalogError('NOT_FOUND');
    const quote = await buildQuote(transaction, customer.userId, {
      ...input,
      cartId: input.cartId,
    } as QuoteInput);
    const variantIds = [
      ...new Set(quote.lines.map((line) => line.item.productVariant.id)),
    ].sort();
    for (const variantId of variantIds) {
      const inventory = await lockInventory(transaction, variantId);
      const needed = quote.lines
        .filter((line) => line.item.productVariant.id === variantId)
        .reduce((sum, line) => sum + line.item.quantity, 0);
      if (!inventory || inventory.onHand - inventory.reserved < needed)
        throw new CatalogError('INVENTORY_INSUFFICIENT');
      await transaction.inventory.update({
        where: { productVariantId: variantId },
        data: { reserved: { increment: needed }, version: { increment: 1 } },
      });
    }
    let slot: { id: string; startsAt: Date; endsAt: Date } | null = null;
    if (quote.requiresInstallation) {
      if (!input.slotId) throw new CatalogError('SLOT_UNAVAILABLE');
      const candidate = await lockCheckoutSlot(transaction, input.slotId);
      if (
        !candidate ||
        !quote.area ||
        candidate.startsAt <= new Date() ||
        candidate.bookedCount >= candidate.capacity
      )
        throw new CatalogError('SLOT_UNAVAILABLE');
      const slotArea = await transaction.installationSlot.findFirst({
        where: {
          id: candidate.id,
          serviceAreaId: quote.area.id,
          isActive: true,
        },
        select: { id: true },
      });
      if (!slotArea) throw new CatalogError('SLOT_UNAVAILABLE');
      await transaction.installationSlot.update({
        where: { id: candidate.id },
        data: { bookedCount: { increment: 1 }, version: { increment: 1 } },
      });
      slot = candidate;
    }
    const order = await transaction.order.create({
      data: {
        orderNumber: orderNumber(),
        userId: customer.userId,
        subtotal: quote.subtotal,
        installationFee: quote.installationFee,
        shippingFee: quote.shippingFee,
        grandTotal: quote.grandTotal,
        recipientName: quote.address.recipientName,
        recipientPhone: quote.address.phone,
        addressLine1: quote.address.line1,
        addressLine2: quote.address.line2,
        wardName: quote.address.wardName,
        districtCode: quote.address.districtCode,
        districtName: quote.address.districtName,
        provinceCode: quote.address.provinceCode,
        provinceName: quote.address.provinceName,
        postalCode: quote.address.postalCode,
        countryCode: quote.address.countryCode,
        serviceAreaId: quote.area?.id,
        idempotencyHash: keyHash,
        requestFingerprint: fingerprint,
        items: {
          create: quote.lines.map(({ item, device, service, unit, total }) => ({
            productVariantId: item.productVariant.id,
            servicePackageId: item.servicePackageId,
            productName: item.productVariant.product.name,
            variantName: item.productVariant.name,
            sku: item.productVariant.sku,
            servicePackageName: item.servicePackage?.name,
            quantity: item.quantity,
            deviceUnitPrice: device,
            serviceUnitPrice: service,
            unitPrice: unit,
            lineTotal: total,
            warrantyMonths: item.productVariant.warrantyMonths,
          })),
        },
        payment: {
          create: {
            method: input.paymentMethod,
            amount: quote.grandTotal,
            referenceCode: paymentReference(),
          },
        },
        ...(slot && quote.area
          ? {
              appointment: {
                create: {
                  serviceAreaId: quote.area.id,
                  slotId: slot.id,
                  status: AppointmentStatus.ASSIGNMENT_PENDING,
                  scheduledStartAt: slot.startsAt,
                  scheduledEndAt: slot.endsAt,
                },
              },
            }
          : {}),
      },
      include: {
        payment: true,
        items: {
          select: { id: true, productVariantId: true, quantity: true },
        },
      },
    });
    await transaction.inventoryAllocation.createMany({
      data: order.items.map((item) => ({
        orderItemId: item.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
      })),
    });
    await transaction.cart.update({
      where: { id: quote.cart.id },
      data: {
        status: CartStatus.CHECKED_OUT,
        checkedOutOrderId: order.id,
        version: { increment: 1 },
      },
    });
    await transaction.checkoutAttempt.update({
      where: { id: attemptId },
      data: { orderId: order.id },
    });
    return { replayed: false, order };
  });
}

const orderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  grandTotal: true,
  currency: true,
  version: true,
  payment: {
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      referenceCode: true,
      providerTransactionId: true,
      paidAt: true,
    },
  },
  items: {
    select: {
      id: true,
      productName: true,
      variantName: true,
      quantity: true,
      lineTotal: true,
    },
  },
  appointment: {
    select: {
      id: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  },
} satisfies Prisma.OrderSelect;

function orderDto(
  order: Prisma.OrderGetPayload<{ select: typeof orderSelect }>,
) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    grandTotal: money(order.grandTotal),
    currency: order.currency,
    version: order.version,
    payment: {
      id: order.payment?.id,
      method: order.payment?.method,
      status: order.payment?.status,
      amount: order.payment ? money(order.payment.amount) : null,
      referenceCode: order.payment?.referenceCode,
      providerTransactionId: order.payment?.providerTransactionId,
      paidAt: order.payment?.paidAt,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      variantName: item.variantName,
      quantity: item.quantity,
      lineTotal: money(item.lineTotal),
    })),
    appointment: order.appointment
      ? {
          id: order.appointment.id,
          status: order.appointment.status,
          scheduledStartAt: order.appointment.scheduledStartAt,
          scheduledEndAt: order.appointment.scheduledEndAt,
        }
      : null,
  };
}
export async function listOrders(
  actor: IdentityActor | null,
  input: OrderListQuery = { limit: 25 },
) {
  const customer = requireCustomer(actor);
  const orders = await prisma.order.findMany({
    where: { userId: customer.userId },
    select: orderSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
  });
  const hasNext = orders.length > input.limit;
  const items = orders.slice(0, input.limit).map(orderDto);
  return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
}
export async function getOrder(actor: IdentityActor | null, id: string) {
  if (!actor) throw new CatalogError('UNAUTHENTICATED');
  const isAdmin = actorHasRole(actor, ['ADMIN']);
  const order = await prisma.order.findFirst({
    where: { id, ...(isAdmin ? {} : { userId: actor.userId }) },
    select: orderSelect,
  });
  return order ? orderDto(order) : null;
}
export async function listSlots(input: SlotQuery) {
  const start = new Date(`${input.fromDate}T00:00:00.000+07:00`);
  const end = new Date(`${input.toDate}T23:59:59.999+07:00`);
  const slots = await prisma.installationSlot.findMany({
    where: {
      serviceAreaId: input.serviceAreaId,
      isActive: true,
      serviceArea: { isActive: true },
      startsAt: { gte: start, lte: end },
      endsAt: { gt: new Date() },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      bookedCount: true,
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
  });
  const hasNext = slots.length > input.limit;
  const items = slots.slice(0, input.limit).map((slot) => ({
    id: slot.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    available: slot.capacity - slot.bookedCount,
  }));
  return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
}
export async function transitionOrder(
  actor: IdentityActor | null,
  id: string,
  action: OrderAction,
  expectedVersion: number,
  reason: string,
  requestId: string,
) {
  const operationsActor = requireOrderOperationsActor(actor);
  return prisma.$transaction(async (transaction) => {
    if (!(await lockOrder(transaction, id)))
      throw new CatalogError('NOT_FOUND');
    const order = await transaction.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        version: true,
        inventoryStatus: true,
        appointment: { select: { id: true } },
        payment: { select: { method: true, status: true } },
        items: {
          select: {
            id: true,
            productVariantId: true,
            quantity: true,
            inventoryAllocation: {
              select: {
                productVariantId: true,
                quantity: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!order) throw new CatalogError('NOT_FOUND');
    if (order.version !== expectedVersion)
      throw new CatalogError('CONCURRENT_MODIFICATION');

    const decision = decideOrderTransition({
      actor: operationsActor,
      action,
      current: order.status,
      inventoryStatus: order.inventoryStatus,
      hasAppointment: Boolean(order.appointment),
      paymentMethod: order.payment?.method ?? null,
      paymentStatus: order.payment?.status ?? null,
    });
    if (!decision.allowed) throw orderPolicyError(decision.code);

    if (decision.inventoryEffect === 'CONSUME_RESERVED')
      await consumeOrderInventory(transaction, order.items);

    const updated = await transaction.order.updateMany({
      where: {
        id,
        version: expectedVersion,
        status: decision.current,
        inventoryStatus: order.inventoryStatus,
      },
      data: {
        status: decision.next,
        version: { increment: 1 },
        ...(decision.inventoryEffect === 'CONSUME_RESERVED'
          ? { inventoryStatus: InventoryDisposition.CONSUMED }
          : {}),
        ...(decision.next === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
        ...(decision.next === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    });
    if (updated.count !== 1) throw new CatalogError('CONCURRENT_MODIFICATION');

    await transaction.auditLog.create({
      data: {
        actorUserId: operationsActor.userId,
        action: `order.${action}`,
        targetType: 'order',
        targetId: id,
        before: {
          status: order.status,
          version: order.version,
          inventoryStatus: order.inventoryStatus,
        },
        after: {
          status: decision.next,
          version: order.version + 1,
          inventoryStatus:
            decision.inventoryEffect === 'CONSUME_RESERVED'
              ? InventoryDisposition.CONSUMED
              : order.inventoryStatus,
        },
        reason,
        requestId,
      },
    });
    return transaction.order.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        status: true,
        inventoryStatus: true,
        version: true,
        confirmedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });
  });
}

type OrderPolicyFailureCode = Extract<
  OrderTransitionDecision,
  { allowed: false }
>['code'];

function orderPolicyError(code: OrderPolicyFailureCode): CatalogError {
  if (code === 'UNAUTHENTICATED' || code === 'FORBIDDEN')
    return new CatalogError(code);
  if (code === 'INVENTORY_NOT_RESERVED')
    return new CatalogError('INVENTORY_CONFLICT');
  return new CatalogError('INVALID_STATE_TRANSITION', code);
}

function requireOrderOperationsActor(actor: IdentityActor | null) {
  const decision = authorizeOrderActor(actor);
  if (!decision.allowed) throw new CatalogError(decision.code);
  return decision.actor;
}

function aggregateOrderItems(
  items: Array<{ productVariantId: string; quantity: number }>,
) {
  const quantities = new Map<string, number>();
  for (const item of items)
    quantities.set(
      item.productVariantId,
      (quantities.get(item.productVariantId) ?? 0) + item.quantity,
    );
  return [...quantities.entries()]
    .map(([productVariantId, quantity]) => ({ productVariantId, quantity }))
    .sort((left, right) =>
      left.productVariantId.localeCompare(right.productVariantId),
    );
}

async function consumeOrderInventory(
  transaction: Prisma.TransactionClient,
  items: Array<{
    id: string;
    productVariantId: string;
    quantity: number;
    inventoryAllocation: {
      productVariantId: string;
      quantity: number;
      status: InventoryDisposition;
    } | null;
  }>,
) {
  for (const item of items) {
    if (
      !item.inventoryAllocation ||
      item.inventoryAllocation.status !== InventoryDisposition.RESERVED ||
      item.inventoryAllocation.productVariantId !== item.productVariantId ||
      item.inventoryAllocation.quantity !== item.quantity
    )
      throw new CatalogError(
        'INVENTORY_CONFLICT',
        'INVENTORY_RESERVATION_INVALID',
      );
  }
  const requirements = aggregateOrderItems(items);
  if (!requirements.length) throw new CatalogError('INVENTORY_CONFLICT');

  const locked = [] as Array<{
    productVariantId: string;
    quantity: number;
    version: number;
  }>;
  for (const requirement of requirements) {
    const inventory = await lockInventory(
      transaction,
      requirement.productVariantId,
    );
    if (
      !inventory ||
      inventory.reserved < requirement.quantity ||
      inventory.onHand < requirement.quantity
    )
      throw new CatalogError(
        'INVENTORY_CONFLICT',
        'INVENTORY_RESERVATION_INVALID',
      );
    locked.push({ ...requirement, version: inventory.version });
  }

  for (const requirement of locked) {
    const updated = await transaction.inventory.updateMany({
      where: {
        productVariantId: requirement.productVariantId,
        version: requirement.version,
        onHand: { gte: requirement.quantity },
        reserved: { gte: requirement.quantity },
      },
      data: {
        onHand: { decrement: requirement.quantity },
        reserved: { decrement: requirement.quantity },
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new CatalogError('INVENTORY_CONFLICT');
  }

  const consumedAt = new Date();
  for (const item of [...items].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const updated = await transaction.inventoryAllocation.updateMany({
      where: {
        orderItemId: item.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        status: InventoryDisposition.RESERVED,
      },
      data: {
        status: InventoryDisposition.CONSUMED,
        consumedAt,
      },
    });
    if (updated.count !== 1) throw new CatalogError('INVENTORY_CONFLICT');
  }
}

export async function getAvailableOrderActions(
  actor: IdentityActor | null,
  id: string,
) {
  const operationsActor = requireOrderOperationsActor(actor);
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      version: true,
      status: true,
      inventoryStatus: true,
      appointment: { select: { id: true } },
      payment: { select: { method: true, status: true } },
    },
  });
  if (!order) throw new CatalogError('NOT_FOUND');
  return {
    id: order.id,
    version: order.version,
    actions: orderActions.flatMap((action) => {
      const decision = decideOrderTransition({
        actor: operationsActor,
        action,
        current: order.status,
        inventoryStatus: order.inventoryStatus,
        hasAppointment: Boolean(order.appointment),
        paymentMethod: order.payment?.method ?? null,
        paymentStatus: order.payment?.status ?? null,
      });
      return decision.allowed
        ? [{ action, label: orderActionLabels[action] }]
        : [];
    }),
  };
}

export async function transitionPayment(
  actor: IdentityActor | null,
  paymentId: string,
  action: PaymentAction,
  expectedVersion: number,
  reason: string,
  confirmationReference: string | undefined,
  requestId: string,
) {
  const operationsActor = requireOrderOperationsActor(actor);
  return prisma.$transaction(async (transaction) => {
    if (!(await lockPayment(transaction, paymentId)))
      throw new CatalogError('NOT_FOUND');

    const payment = await transaction.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        orderId: true,
        method: true,
        status: true,
        version: true,
        amount: true,
        currency: true,
        order: { select: { grandTotal: true, currency: true } },
      },
    });
    if (!payment) throw new CatalogError('NOT_FOUND');
    if (payment.version !== expectedVersion)
      throw new CatalogError('CONCURRENT_MODIFICATION');

    const decision = decidePaymentTransition({
      actor: operationsActor,
      action,
      current: payment.status,
      method: payment.method,
    });
    if (!decision.allowed) throw new CatalogError(decision.code);
    if (
      action === 'CONFIRM_PAYMENT' &&
      (payment.amount !== payment.order.grandTotal ||
        payment.currency !== payment.order.currency)
    )
      throw new CatalogError('CONFLICT', 'PAYMENT_AMOUNT_MISMATCH');

    const updated = await transaction.payment.updateMany({
      where: {
        id: payment.id,
        version: expectedVersion,
        status: decision.current,
      },
      data: {
        status: decision.next,
        version: { increment: 1 },
        ...(confirmationReference ? { confirmationReference } : {}),
      },
    });
    if (updated.count !== 1) throw new CatalogError('CONCURRENT_MODIFICATION');

    await transaction.auditLog.create({
      data: {
        actorUserId: operationsActor.userId,
        action: `payment.${action.toLowerCase()}`,
        targetType: 'payment',
        targetId: payment.id,
        before: { status: payment.status, version: payment.version },
        after: {
          status: decision.next,
          version: payment.version + 1,
          hasConfirmationReference: Boolean(confirmationReference),
        },
        reason,
        requestId,
      },
    });

    return transaction.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: {
        id: true,
        orderId: true,
        method: true,
        status: true,
        version: true,
      },
    });
  });
}

export async function getAvailablePaymentActions(
  actor: IdentityActor | null,
  paymentId: string,
) {
  const operationsActor = requireOrderOperationsActor(actor);
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, version: true, status: true, method: true },
  });
  if (!payment) throw new CatalogError('NOT_FOUND');

  return {
    id: payment.id,
    version: payment.version,
    actions: paymentActions.flatMap((action) => {
      const decision = decidePaymentTransition({
        actor: operationsActor,
        action,
        current: payment.status,
        method: payment.method,
      });
      return decision.allowed
        ? [{ action, label: paymentActionLabels[action] }]
        : [];
    }),
  };
}
