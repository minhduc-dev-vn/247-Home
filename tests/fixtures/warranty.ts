import { randomUUID } from 'node:crypto';

import {
  InventoryDisposition,
  OrderStatus,
  PaymentStatus,
  type RoleCode,
  type PrismaClient,
} from '@prisma/client';
import { hash } from 'bcryptjs';

import { type IdentityActor } from '@/modules/identity';
import { getEvidenceStorage } from '@/modules/storage';
import { prisma } from '@/shared/db/client';

type FixtureUser = {
  id: string;
  email: string;
  actor: IdentityActor;
};

export const warrantyFixturePassword = 'WarrantyE2EOnly-247Home';

export type WarrantyFixture = {
  namespace: string;
  users: {
    customerA: FixtureUser;
    customerB: FixtureUser;
    staff: FixtureUser;
    manager: FixtureUser;
    technician: FixtureUser;
    admin: FixtureUser;
  };
  orderItems: {
    eligibleDevice: string;
    eligibleInstallation: string;
    incomplete: string;
    otherCustomer: string;
  };
  orders: {
    eligible: string;
    incomplete: string;
    otherCustomer: string;
  };
  productId: string;
  cleanup(): Promise<void>;
};

async function createUser(
  client: PrismaClient,
  namespace: string,
  label: string,
  roles: IdentityActor['roles'],
  passwordHash: string,
): Promise<FixtureUser> {
  const roleRows = await client.role.findMany({
    where: { code: { in: roles as RoleCode[] } },
    select: { id: true },
  });
  if (roleRows.length !== roles.length) {
    throw new Error('Warranty fixture roles are not seeded.');
  }
  const email = `${namespace}-${label}@example.test`;
  const user = await client.user.create({
    data: {
      email,
      name: `Warranty ${label}`,
      passwordHash,
      roles: { create: roleRows.map((role) => ({ roleId: role.id })) },
    },
  });
  return {
    id: user.id,
    email,
    actor: { userId: user.id, authVersion: user.authVersion, roles },
  };
}

export async function createWarrantyFixture(
  client: PrismaClient = prisma,
): Promise<WarrantyFixture> {
  const namespace = `warranty-${randomUUID()}`;
  const passwordHash = await hash(warrantyFixturePassword, 10);
  const customerA = await createUser(
    client,
    namespace,
    'customer-a',
    ['CUSTOMER'],
    passwordHash,
  );
  const customerB = await createUser(
    client,
    namespace,
    'customer-b',
    ['CUSTOMER'],
    passwordHash,
  );
  const staff = await createUser(
    client,
    namespace,
    'staff',
    ['STAFF'],
    passwordHash,
  );
  const manager = await createUser(
    client,
    namespace,
    'manager',
    ['MANAGER'],
    passwordHash,
  );
  const technician = await createUser(
    client,
    namespace,
    'technician',
    ['TECHNICIAN'],
    passwordHash,
  );
  const admin = await createUser(
    client,
    namespace,
    'admin',
    ['ADMIN'],
    passwordHash,
  );
  const userIds = [
    customerA.id,
    customerB.id,
    staff.id,
    manager.id,
    technician.id,
    admin.id,
  ];

  const product = await client.product.create({
    data: {
      slug: namespace,
      name: 'Warranty fixture product',
      description: 'Warranty integration fixture product.',
      category: 'SECURITY_CAMERA',
      status: 'ACTIVE',
      variants: {
        create: {
          sku: `WAR-${randomUUID().replaceAll('-', '').slice(0, 16)}`,
          name: 'Warranty fixture variant',
          priceVnd: 1_500_000,
          warrantyMonths: 12,
        },
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0];
  if (!variant) throw new Error('Warranty fixture variant was not created.');
  const servicePackage = await client.servicePackage.create({
    data: {
      productVariantId: variant.id,
      name: 'Warranty fixture installation',
      description: 'Test-only installation package.',
      priceVnd: 200_000,
    },
  });

  let sequence = 0;
  async function createOrder(
    customer: FixtureUser,
    status: OrderStatus,
    completedAt: Date | null,
  ) {
    sequence += 1;
    const total = 3_200_000n;
    return client.order.create({
      data: {
        orderNumber: `${namespace.toUpperCase()}-${sequence}`,
        userId: customer.id,
        status,
        inventoryStatus:
          status === OrderStatus.COMPLETED
            ? InventoryDisposition.CONSUMED
            : InventoryDisposition.RESERVED,
        subtotal: total,
        installationFee: 0,
        shippingFee: 0,
        grandTotal: total,
        recipientName: 'Warranty Customer',
        recipientPhone: '0900000000',
        addressLine1: '1 Warranty Test Street',
        wardName: 'Test Ward',
        districtCode: 'TEST-DISTRICT',
        districtName: 'Test District',
        provinceCode: 'TEST-PROVINCE',
        provinceName: 'Test Province',
        countryCode: 'VN',
        idempotencyHash: `${namespace}-${sequence}`,
        requestFingerprint: `${namespace}-${sequence}`,
        completedAt,
        items: {
          create: [
            {
              productVariantId: variant.id,
              productName: product.name,
              variantName: variant.name,
              sku: variant.sku,
              quantity: 1,
              deviceUnitPrice: 1_500_000,
              serviceUnitPrice: 0,
              unitPrice: 1_500_000,
              lineTotal: 1_500_000,
              warrantyMonths: 12,
            },
            {
              productVariantId: variant.id,
              servicePackageId: servicePackage.id,
              productName: product.name,
              variantName: variant.name,
              sku: variant.sku,
              servicePackageName: servicePackage.name,
              quantity: 1,
              deviceUnitPrice: 1_500_000,
              serviceUnitPrice: 200_000,
              unitPrice: 1_700_000,
              lineTotal: 1_700_000,
              warrantyMonths: 12,
            },
          ],
        },
        payment: {
          create: {
            method: 'COD',
            status:
              status === OrderStatus.COMPLETED
                ? PaymentStatus.PAID
                : PaymentStatus.PENDING,
            amount: total,
            referenceCode: `PAY-${namespace}-${sequence}`,
          },
        },
      },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  const completedAt = new Date();
  completedAt.setUTCMonth(completedAt.getUTCMonth() - 1);
  const eligible = await createOrder(
    customerA,
    OrderStatus.COMPLETED,
    completedAt,
  );
  const incomplete = await createOrder(customerA, OrderStatus.PROCESSING, null);
  const other = await createOrder(
    customerB,
    OrderStatus.COMPLETED,
    completedAt,
  );

  async function cleanup() {
    const errors: unknown[] = [];
    const evidence = await client.warrantyEvidence.findMany({
      where: { warrantyRequest: { customerUserId: { in: userIds } } },
      select: { storageKey: true },
    });
    for (const item of evidence) {
      try {
        await getEvidenceStorage().delete(item.storageKey);
      } catch (error: unknown) {
        errors.push(error);
      }
    }
    const steps = [
      () =>
        client.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } }),
      () =>
        client.warrantyEvidence.deleteMany({
          where: { warrantyRequest: { customerUserId: { in: userIds } } },
        }),
      () =>
        client.warrantyRequest.deleteMany({
          where: { customerUserId: { in: userIds } },
        }),
      () =>
        client.payment.deleteMany({
          where: { order: { userId: { in: userIds } } },
        }),
      () =>
        client.orderItem.deleteMany({
          where: { order: { userId: { in: userIds } } },
        }),
      () => client.order.deleteMany({ where: { userId: { in: userIds } } }),
      () => client.servicePackage.delete({ where: { id: servicePackage.id } }),
      () => client.productVariant.delete({ where: { id: variant.id } }),
      () => client.product.delete({ where: { id: product.id } }),
      () => client.user.deleteMany({ where: { id: { in: userIds } } }),
    ];
    for (const step of steps) {
      try {
        await step();
      } catch (error: unknown) {
        errors.push(error);
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, `Failed to clean ${namespace}.`);
    }
  }

  const eligibleDevice = eligible.items.find(
    (item) => item.servicePackageId === null,
  );
  const eligibleInstallation = eligible.items.find(
    (item) => item.servicePackageId !== null,
  );
  const incompleteItem = incomplete.items.find(
    (item) => item.servicePackageId === null,
  );
  const otherCustomerItem = other.items.find(
    (item) => item.servicePackageId === null,
  );
  if (
    !eligibleDevice ||
    !eligibleInstallation ||
    !incompleteItem ||
    !otherCustomerItem
  ) {
    throw new Error('Warranty fixture order items were not created.');
  }

  return {
    namespace,
    users: {
      customerA,
      customerB,
      staff,
      manager,
      technician,
      admin,
    },
    orderItems: {
      eligibleDevice: eligibleDevice.id,
      eligibleInstallation: eligibleInstallation.id,
      incomplete: incompleteItem.id,
      otherCustomer: otherCustomerItem.id,
    },
    orders: {
      eligible: eligible.id,
      incomplete: incomplete.id,
      otherCustomer: other.id,
    },
    productId: product.id,
    cleanup,
  };
}
