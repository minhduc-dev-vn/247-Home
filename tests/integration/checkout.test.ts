import { randomUUID } from 'node:crypto';

import { AppointmentStatus } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import {
  addCartItem,
  checkout,
  createAddress,
  getOrder,
  listSlots,
} from '@/modules/commerce';
import { checkoutInputSchema } from '@/modules/commerce/presentation/schemas';
import { type IdentityActor } from '@/modules/identity';
import { prisma } from '@/shared/db/client';

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];
const createdAreaIds: string[] = [];

async function user(label: string): Promise<IdentityActor> {
  const record = await prisma.user.create({
    data: {
      email: `${label}-${randomUUID()}@example.test`,
      name: label,
      passwordHash: 'test-only-hash',
    },
  });
  createdUserIds.push(record.id);
  return { userId: record.id, authVersion: 1, roles: ['CUSTOMER'] };
}

async function fixture(options: {
  stock: number;
  withPackage?: boolean;
  slot?: 'future' | 'past' | 'full';
}) {
  const suffix = randomUUID().replaceAll('-', '');
  const area = await prisma.serviceArea.create({
    data: {
      code: `TEST-${suffix}`,
      provinceCode: `P${suffix.slice(0, 8)}`,
      provinceName: 'Test Province',
      districtCode: `D${suffix.slice(0, 8)}`,
      districtName: 'Test District',
    },
  });
  createdAreaIds.push(area.id);
  const product = await prisma.product.create({
    data: {
      slug: `checkout-${suffix}`,
      name: 'Checkout test product',
      description: 'Fixture.',
      category: 'SECURITY_CAMERA',
      status: 'ACTIVE',
    },
  });
  createdProductIds.push(product.id);
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `CHK-${suffix.slice(0, 16).toUpperCase()}`,
      name: 'Fixture variant',
      priceVnd: 1000000,
      inventory: { create: { onHand: options.stock } },
    },
  });
  const pkg = options.withPackage
    ? await prisma.servicePackage.create({
        data: {
          productVariantId: variant.id,
          name: 'Fixture install',
          description: 'Fixture installation.',
          priceVnd: 100000,
        },
      })
    : null;
  const startsAt = new Date();
  startsAt.setUTCDate(
    startsAt.getUTCDate() + (options.slot === 'past' ? -1 : 2),
  );
  startsAt.setUTCHours(3, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setUTCHours(5);
  const slot = options.slot
    ? await prisma.installationSlot.create({
        data: {
          serviceAreaId: area.id,
          startsAt,
          endsAt,
          capacity: 1,
          bookedCount: options.slot === 'full' ? 1 : 0,
        },
      })
    : null;
  return { area, product, variant, pkg, slot };
}

async function checkoutInput(
  actor: IdentityActor,
  data: Awaited<ReturnType<typeof fixture>>,
  key: string,
) {
  const address = await createAddress(actor, {
    recipientName: 'Test Customer',
    phone: '0900000000',
    line1: '1 Test Street',
    wardName: 'Test Ward',
    districtCode: data.area.districtCode,
    districtName: data.area.districtName,
    provinceCode: data.area.provinceCode,
    provinceName: data.area.provinceName,
  });
  const cart = await addCartItem(actor, {
    productVariantId: data.variant.id,
    servicePackageId: data.pkg?.id ?? null,
    quantity: 1,
  });
  return checkout(
    actor,
    {
      cartId: cart.id,
      addressId: address.id,
      paymentMethod: 'COD',
      slotId: data.slot?.id ?? null,
    },
    key,
    `test_${key}`,
  );
}

describe('checkout transaction invariants', () => {
  it('allows only one concurrent customer to buy the final SKU', async () => {
    const data = await fixture({ stock: 1 });
    const first = await user('first');
    const second = await user('second');
    const results = await Promise.allSettled([
      checkoutInput(first, data, `first-${randomUUID()}`),
      checkoutInput(second, data, `second-${randomUUID()}`),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    await expect(
      prisma.inventory.findUniqueOrThrow({
        where: { productVariantId: data.variant.id },
      }),
    ).resolves.toMatchObject({ reserved: 1 });
  });

  it('replays a double checkout click and ignores client monetary fields at the validation boundary', async () => {
    const data = await fixture({ stock: 2 });
    const actor = await user('replay');
    const key = `replay-${randomUUID()}`;
    const address = await createAddress(actor, {
      recipientName: 'Test Customer',
      phone: '0900000000',
      line1: '1 Test Street',
      wardName: 'Test Ward',
      districtCode: data.area.districtCode,
      districtName: data.area.districtName,
      provinceCode: data.area.provinceCode,
      provinceName: data.area.provinceName,
    });
    const cart = await addCartItem(actor, {
      productVariantId: data.variant.id,
      quantity: 1,
    });
    const input = {
      cartId: cart.id,
      addressId: address.id,
      paymentMethod: 'COD' as const,
      slotId: null,
    };
    const [first, second] = await Promise.all([
      checkout(actor, input, key, 'replay-one'),
      checkout(actor, input, key, 'replay-two'),
    ]);
    expect(first.order.id).toBe(second.order.id);
    expect([first.replayed, second.replayed]).toContain(true);
    expect(
      checkoutInputSchema.safeParse({
        cartId: first.order.id,
        addressId: first.order.id,
        paymentMethod: 'COD',
        grandTotal: '1',
      }).success,
    ).toBe(false);
  });

  it('allows only one concurrent customer to reserve the final installation slot', async () => {
    const data = await fixture({ stock: 2, withPackage: true, slot: 'future' });
    const first = await user('slot-first');
    const second = await user('slot-second');
    const results = await Promise.allSettled([
      checkoutInput(first, data, `slot-first-${randomUUID()}`),
      checkoutInput(second, data, `slot-second-${randomUUID()}`),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const successfulCheckout = results.find(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof checkoutInput>>
      > => result.status === 'fulfilled',
    );
    await expect(
      prisma.installationAppointment.findUniqueOrThrow({
        where: { orderId: successfulCheckout!.value.order.id },
      }),
    ).resolves.toMatchObject({
      status: AppointmentStatus.ASSIGNMENT_PENDING,
    });
    await expect(
      prisma.installationSlot.findUniqueOrThrow({
        where: { id: data.slot!.id },
      }),
    ).resolves.toMatchObject({ bookedCount: 1 });
  });

  it('rejects unsupported service areas and rolls back inventory when appointment booking fails', async () => {
    const unsupported = await fixture({ stock: 1, withPackage: true });
    const actor = await user('unsupported');
    const address = await createAddress(actor, {
      recipientName: 'Test Customer',
      phone: '0900000000',
      line1: '1 Test Street',
      wardName: 'Test Ward',
      districtCode: 'NOAREA',
      districtName: 'No Area',
      provinceCode: 'NOAREA',
      provinceName: 'No Area',
    });
    const cart = await addCartItem(actor, {
      productVariantId: unsupported.variant.id,
      servicePackageId: unsupported.pkg!.id,
      quantity: 1,
    });
    await expect(
      checkout(
        actor,
        {
          cartId: cart.id,
          addressId: address.id,
          paymentMethod: 'COD',
          slotId: null,
        },
        `unsupported-${randomUUID()}`,
        'unsupported',
      ),
    ).rejects.toMatchObject({ code: 'SERVICE_AREA_UNSUPPORTED' });
    const past = await fixture({ stock: 1, withPackage: true, slot: 'past' });
    const pastActor = await user('past');
    await expect(
      checkoutInput(pastActor, past, `past-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    await expect(
      prisma.inventory.findUniqueOrThrow({
        where: { productVariantId: past.variant.id },
      }),
    ).resolves.toMatchObject({ reserved: 0 });
  });

  it('does not return another customer order', async () => {
    const data = await fixture({ stock: 2 });
    const owner = await user('owner');
    const other = await user('other');
    const result = await checkoutInput(owner, data, `owner-${randomUUID()}`);
    await expect(getOrder(other, result.order.id)).resolves.toBeNull();
  });

  it('keeps aggregate cart quantity within the database limit', async () => {
    const data = await fixture({ stock: 100 });
    const actor = await user('cart-limit');
    const cart = await addCartItem(actor, {
      productVariantId: data.variant.id,
      quantity: 99,
    });
    await expect(
      addCartItem(actor, {
        productVariantId: data.variant.id,
        quantity: 1,
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'CART_QUANTITY_LIMIT',
    });
    await expect(
      prisma.cartItem.findUniqueOrThrow({ where: { id: cart.items[0].id } }),
    ).resolves.toMatchObject({ quantity: 99 });
  });

  it('serializes default-address changes and enforces the invariant in PostgreSQL', async () => {
    const data = await fixture({ stock: 0 });
    const actor = await user('default-address');
    const address = (recipientName: string) => ({
      recipientName,
      phone: '0900000000',
      line1: `${recipientName} Street`,
      wardName: 'Test Ward',
      districtCode: data.area.districtCode,
      districtName: data.area.districtName,
      provinceCode: data.area.provinceCode,
      provinceName: data.area.provinceName,
      isDefault: true,
    });

    await expect(
      Promise.all([
        createAddress(actor, address('Default A')),
        createAddress(actor, address('Default B')),
      ]),
    ).resolves.toHaveLength(2);
    await expect(
      prisma.address.count({
        where: { userId: actor.userId, archivedAt: null, isDefault: true },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.address.create({
        data: {
          ...address('Constraint probe'),
          userId: actor.userId,
          serviceAreaId: data.area.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('interprets slot date filters in the Vietnam service timezone', async () => {
    const data = await fixture({ stock: 0 });
    const inside = await prisma.installationSlot.create({
      data: {
        serviceAreaId: data.area.id,
        startsAt: new Date('2099-01-01T17:30:00.000Z'),
        endsAt: new Date('2099-01-01T19:30:00.000Z'),
        capacity: 1,
      },
    });
    const nextLocalDay = await prisma.installationSlot.create({
      data: {
        serviceAreaId: data.area.id,
        startsAt: new Date('2099-01-02T17:30:00.000Z'),
        endsAt: new Date('2099-01-02T19:30:00.000Z'),
        capacity: 1,
      },
    });

    const page = await listSlots({
      serviceAreaId: data.area.id,
      fromDate: '2099-01-02',
      toDate: '2099-01-02',
      limit: 25,
    });
    expect(page.items.map(({ id }) => id)).toContain(inside.id);
    expect(page.items.map(({ id }) => id)).not.toContain(nextLocalDay.id);
  });
});

afterAll(async () => {
  const orders = await prisma.order.findMany({
    where: { userId: { in: createdUserIds } },
    select: { id: true },
  });
  const orderIds = orders.map(({ id }) => id);
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const orderItemIds = orderItems.map(({ id }) => id);
  const variants = await prisma.productVariant.findMany({
    where: { productId: { in: createdProductIds } },
    select: { id: true },
  });
  const variantIds = variants.map(({ id }) => id);

  await prisma.inventoryAllocation.deleteMany({
    where: { orderItemId: { in: orderItemIds } },
  });
  await prisma.checkoutAttempt.deleteMany({
    where: {
      OR: [{ userId: { in: createdUserIds } }, { orderId: { in: orderIds } }],
    },
  });
  await prisma.cart.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.installationAppointment.deleteMany({
    where: { orderId: { in: orderIds } },
  });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { id: { in: orderItemIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.address.deleteMany({
    where: { userId: { in: createdUserIds } },
  });
  await prisma.installationSlot.deleteMany({
    where: { serviceAreaId: { in: createdAreaIds } },
  });
  await prisma.servicePackage.deleteMany({
    where: { productVariantId: { in: variantIds } },
  });
  await prisma.inventory.deleteMany({
    where: { productVariantId: { in: variantIds } },
  });
  await prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.serviceArea.deleteMany({
    where: { id: { in: createdAreaIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});
