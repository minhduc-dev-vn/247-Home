import { randomUUID } from 'node:crypto';

import {
  AppointmentStatus,
  AssignmentStatus,
  InventoryDisposition,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductCategory,
  RoleCode,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { hash } from 'bcryptjs';

import { type IdentityActor } from '@/modules/identity';
import { getEvidenceStorage } from '@/modules/storage';
import { prisma as sharedPrisma } from '@/shared/db/client';

export const operationsFixturePassword = 'OperationsTestOnly-247Home';

type FixtureUser = {
  id: string;
  email: string;
  actor: IdentityActor;
};

type FixtureTechnician = FixtureUser & { technicianId: string };

type Slot = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
};

type Appointment = {
  id: string;
  version: number;
  status: AppointmentStatus;
  slotId: string;
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  paymentId: string;
  paymentVersion: number;
};

type CreateAppointmentOptions = {
  customer?: FixtureUser;
  slot?: Slot;
  status?: AppointmentStatus;
  orderStatus?: OrderStatus;
  assignedTechnician?: FixtureTechnician;
  slotCapacity?: number;
  slotBookedCount?: number;
  paymentStatus?: PaymentStatus;
};

const roleCodes = Object.values(RoleCode);

export type OperationsFixture = {
  namespace: string;
  users: {
    admin: FixtureUser;
    manager: FixtureUser;
    staff: FixtureUser;
    customerA: FixtureUser;
    customerB: FixtureUser;
    technicianA: FixtureTechnician;
    technicianB: FixtureTechnician;
    outOfAreaTechnician: FixtureTechnician;
    inactiveTechnician: FixtureTechnician;
  };
  serviceAreas: { primaryId: string; secondaryId: string };
  slots: {
    pending: Slot;
    assigned: Slot;
    validRescheduleTarget: Slot;
    fullRescheduleTarget: Slot;
    concurrentRescheduleTarget: Slot;
  };
  appointments: {
    pending: Appointment;
    assigned: Appointment & { assignmentId: string };
    overlapping: Appointment;
    fullSlot: Appointment;
  };
  warrantyRequestId: string;
  createSlot: (
    offsetHours: number,
    capacity?: number,
    bookedCount?: number,
  ) => Promise<Slot>;
  createAppointment: (
    options?: CreateAppointmentOptions,
  ) => Promise<Appointment & { assignmentId?: string }>;
  createWarranty: (
    orderItemId: string,
    customer?: FixtureUser,
  ) => Promise<string>;
  cleanup: () => Promise<void>;
};

export type CleanupStep = {
  name: string;
  run: () => Promise<void>;
};

function namespaceFilter(namespace: string) {
  if (!/^ops[0-9a-f]{32}$/.test(namespace))
    throw new Error('Operations fixture namespace is invalid.');
  return namespace;
}

export async function runFailureSafeCleanup(steps: CleanupStep[]) {
  const errors: Error[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch (error: unknown) {
      errors.push(
        new Error(
          `${step.name}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        ),
      );
    }
  }
  if (errors.length)
    throw new AggregateError(errors, 'Operations test cleanup failed.');
}

export async function cleanupOperationsFixtureNamespace(
  namespace: string,
  client: PrismaClient = sharedPrisma,
) {
  const safeNamespace = namespaceFilter(namespace);
  const [users, products, areas, orders] = await Promise.all([
    client.user.findMany({
      where: { email: { startsWith: `${safeNamespace}.` } },
      select: { id: true },
    }),
    client.product.findMany({
      where: { slug: { startsWith: `${safeNamespace}-` } },
      select: { id: true },
    }),
    client.serviceArea.findMany({
      where: { code: { startsWith: `${safeNamespace}-` } },
      select: { id: true },
    }),
    client.order.findMany({
      where: { orderNumber: { startsWith: `${safeNamespace.toUpperCase()}-` } },
      select: { id: true },
    }),
  ]);
  const userIds = users.map(({ id }) => id);
  const productIds = products.map(({ id }) => id);
  const areaIds = areas.map(({ id }) => id);
  const orderIds = orders.map(({ id }) => id);
  const [appointments, orderItems, technicians, variants, slots] =
    await Promise.all([
      client.installationAppointment.findMany({
        where: { orderId: { in: orderIds } },
        select: { id: true },
      }),
      client.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: { id: true },
      }),
      client.technician.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      }),
      client.productVariant.findMany({
        where: { productId: { in: productIds } },
        select: { id: true },
      }),
      client.installationSlot.findMany({
        where: { serviceAreaId: { in: areaIds } },
        select: { id: true },
      }),
    ]);
  const appointmentIds = appointments.map(({ id }) => id);
  const orderItemIds = orderItems.map(({ id }) => id);
  const technicianIds = technicians.map(({ id }) => id);
  const variantIds = variants.map(({ id }) => id);
  const slotIds = slots.map(({ id }) => id);
  const [assignments, warranties] = await Promise.all([
    client.technicianAssignment.findMany({
      where: { appointmentId: { in: appointmentIds } },
      select: { id: true },
    }),
    client.warrantyRequest.findMany({
      where: {
        OR: [
          { orderItemId: { in: orderItemIds } },
          { customerUserId: { in: userIds } },
          { assignedStaffUserId: { in: userIds } },
        ],
      },
      select: { id: true },
    }),
  ]);
  const assignmentIds = assignments.map(({ id }) => id);
  const warrantyIds = warranties.map(({ id }) => id);
  const evidence = await client.installationEvidence.findMany({
    where: { assignmentId: { in: assignmentIds } },
    select: { id: true, storageKey: true },
  });
  const evidenceIds = evidence.map(({ id }) => id);
  const targetIds = [
    safeNamespace,
    ...orderIds,
    ...orderItemIds,
    ...appointmentIds,
    ...assignmentIds,
    ...warrantyIds,
    ...evidenceIds,
    ...slotIds,
  ];
  const auditWhere: Prisma.AuditLogWhereInput = {
    OR: [{ actorUserId: { in: userIds } }, { targetId: { in: targetIds } }],
  };

  await runFailureSafeCleanup([
    {
      name: 'delete fixture audit rows',
      run: () =>
        client.auditLog.deleteMany({ where: auditWhere }).then(() => undefined),
    },
    {
      name: 'delete fixture evidence rows',
      run: () =>
        client.installationEvidence
          .deleteMany({ where: { id: { in: evidenceIds } } })
          .then(() => undefined),
    },
    {
      name: 'remove fixture evidence files',
      run: () =>
        Promise.all(
          evidence.map(({ storageKey }) =>
            getEvidenceStorage().delete(storageKey),
          ),
        ).then(() => undefined),
    },
    {
      name: 'delete fixture warranty rows',
      run: () =>
        client.warrantyRequest
          .deleteMany({ where: { id: { in: warrantyIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture checkout attempts',
      run: () =>
        client.checkoutAttempt
          .deleteMany({
            where: {
              OR: [{ userId: { in: userIds } }, { orderId: { in: orderIds } }],
            },
          })
          .then(() => undefined),
    },
    {
      name: 'delete fixture cart items',
      run: async () => {
        const carts = await client.cart.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        });
        await client.cartItem.deleteMany({
          where: { cartId: { in: carts.map(({ id }) => id) } },
        });
        await client.cart.deleteMany({
          where: { id: { in: carts.map(({ id }) => id) } },
        });
      },
    },
    {
      name: 'delete fixture assignments',
      run: () =>
        client.technicianAssignment
          .deleteMany({ where: { id: { in: assignmentIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture appointments',
      run: () =>
        client.installationAppointment
          .deleteMany({ where: { id: { in: appointmentIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture payments',
      run: () =>
        client.payment
          .deleteMany({ where: { orderId: { in: orderIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture inventory allocations',
      run: () =>
        client.inventoryAllocation
          .deleteMany({ where: { orderItemId: { in: orderItemIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture order items',
      run: () =>
        client.orderItem
          .deleteMany({ where: { id: { in: orderItemIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture orders',
      run: () =>
        client.order
          .deleteMany({ where: { id: { in: orderIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture slots',
      run: () =>
        client.installationSlot
          .deleteMany({ where: { id: { in: slotIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture technician service areas',
      run: () =>
        client.technicianServiceArea
          .deleteMany({ where: { technicianId: { in: technicianIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture technicians',
      run: () =>
        client.technician
          .deleteMany({ where: { id: { in: technicianIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture addresses',
      run: () =>
        client.address
          .deleteMany({ where: { userId: { in: userIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture user roles',
      run: () =>
        client.userRole
          .deleteMany({ where: { userId: { in: userIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture users',
      run: () =>
        client.user
          .deleteMany({ where: { id: { in: userIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture inventory',
      run: () =>
        client.inventory
          .deleteMany({ where: { productVariantId: { in: variantIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture variants',
      run: () =>
        client.productVariant
          .deleteMany({ where: { id: { in: variantIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture products',
      run: () =>
        client.product
          .deleteMany({ where: { id: { in: productIds } } })
          .then(() => undefined),
    },
    {
      name: 'delete fixture service areas',
      run: () =>
        client.serviceArea
          .deleteMany({ where: { id: { in: areaIds } } })
          .then(() => undefined),
    },
  ]);
}

export async function createOperationsFixture(
  client: PrismaClient = sharedPrisma,
): Promise<OperationsFixture> {
  const namespace = `ops${randomUUID().replaceAll('-', '')}`;
  await Promise.all(
    roleCodes.map((code) =>
      client.role.upsert({ where: { code }, create: { code }, update: {} }),
    ),
  );
  const roles = new Map(
    await client.role
      .findMany({
        where: { code: { in: roleCodes } },
        select: { id: true, code: true },
      })
      .then((items) => items.map((item) => [item.code, item.id] as const)),
  );
  const passwordHash = await hash(operationsFixturePassword, 10);
  let userSequence = 0;

  async function createUser(
    name: string,
    role: RoleCode,
  ): Promise<FixtureUser> {
    const roleId = roles.get(role);
    if (!roleId) throw new Error(`Missing fixture role ${role}.`);
    const user = await client.user.create({
      data: {
        email: `${namespace}.${++userSequence}.${role.toLowerCase()}@local.247home.test`,
        name,
        passwordHash,
        roles: { create: { roleId } },
      },
      select: { id: true, email: true },
    });
    return {
      ...user,
      actor: { userId: user.id, authVersion: 1, roles: [role] },
    };
  }

  const [admin, manager, staff, customerA, customerB] = await Promise.all([
    createUser('Fixture Admin', RoleCode.ADMIN),
    createUser('Fixture Manager', RoleCode.MANAGER),
    createUser('Fixture Staff', RoleCode.STAFF),
    createUser('Fixture Customer A', RoleCode.CUSTOMER),
    createUser('Fixture Customer B', RoleCode.CUSTOMER),
  ]);

  const primaryArea = await client.serviceArea.create({
    data: {
      code: `${namespace}-PRIMARY`,
      provinceCode: `${namespace.slice(0, 8)}P`,
      provinceName: 'Fixture Province',
      districtCode: 'PRIMARY',
      districtName: 'Fixture District',
      installationFee: 0,
      shippingFee: 0,
    },
  });
  const secondaryArea = await client.serviceArea.create({
    data: {
      code: `${namespace}-SECONDARY`,
      provinceCode: `${namespace.slice(0, 8)}S`,
      provinceName: 'Fixture Province Two',
      districtCode: 'SECONDARY',
      districtName: 'Fixture District Two',
      installationFee: 0,
      shippingFee: 0,
    },
  });

  async function createTechnician(
    name: string,
    isActive: boolean,
    areaIds: string[],
  ): Promise<FixtureTechnician> {
    const user = await createUser(name, RoleCode.TECHNICIAN);
    const technician = await client.technician.create({
      data: {
        userId: user.id,
        isActive,
        serviceAreas: {
          create: areaIds.map((serviceAreaId) => ({ serviceAreaId })),
        },
      },
      select: { id: true },
    });
    return { ...user, technicianId: technician.id };
  }

  const [technicianA, technicianB, outOfAreaTechnician, inactiveTechnician] =
    await Promise.all([
      createTechnician('Fixture Technician A', true, [primaryArea.id]),
      createTechnician('Fixture Technician B', true, [primaryArea.id]),
      createTechnician('Fixture Technician Other Area', true, [
        secondaryArea.id,
      ]),
      createTechnician('Fixture Technician Inactive', false, [primaryArea.id]),
    ]);

  const product = await client.product.create({
    data: {
      slug: `${namespace}-product`,
      name: 'Fixture installation product',
      description: 'Created only for Operations tests.',
      category: ProductCategory.SECURITY_CAMERA,
      status: 'ACTIVE',
    },
  });
  const variant = await client.productVariant.create({
    data: {
      productId: product.id,
      sku: `${namespace.slice(0, 20).toUpperCase()}-SKU`,
      name: 'Fixture variant',
      priceVnd: 1_000_000,
      inventory: { create: { onHand: 100 } },
    },
  });

  const base = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
  base.setUTCHours(8, 0, 0, 0);
  let slotSequence = 0;
  let orderSequence = 0;

  async function createSlot(
    offsetHours: number,
    capacity = 1,
    bookedCount = 0,
  ): Promise<Slot> {
    const startsAt = new Date(base.getTime() + offsetHours * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    const slot = await client.installationSlot.create({
      data: {
        serviceAreaId: primaryArea.id,
        startsAt,
        endsAt,
        capacity,
        bookedCount,
      },
      select: { id: true, startsAt: true, endsAt: true, capacity: true },
    });
    slotSequence += 1;
    return slot;
  }

  async function createAppointment(
    options: CreateAppointmentOptions = {},
  ): Promise<Appointment & { assignmentId?: string }> {
    const slot =
      options.slot ??
      (await createSlot(
        20 + slotSequence * 4,
        options.slotCapacity ?? 1,
        options.slotBookedCount ?? 1,
      ));
    const customer = options.customer ?? customerA;
    const number = ++orderSequence;
    const orderStatus =
      options.orderStatus ?? OrderStatus.READY_FOR_INSTALLATION;
    const inventoryStatus =
      orderStatus === OrderStatus.CANCELLED
        ? InventoryDisposition.RELEASED
        : (
              [
                OrderStatus.PENDING_CONFIRMATION,
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING,
              ] as readonly OrderStatus[]
            ).includes(orderStatus)
          ? InventoryDisposition.RESERVED
          : InventoryDisposition.CONSUMED;
    const order = await client.order.create({
      data: {
        orderNumber: `${namespace.toUpperCase()}-${number}`,
        userId: customer.id,
        status: orderStatus,
        inventoryStatus,
        subtotal: 1_000_000,
        installationFee: 0,
        shippingFee: 0,
        grandTotal: 1_000_000,
        recipientName: customer === customerA ? 'Customer A' : 'Customer B',
        recipientPhone: '0900000000',
        addressLine1: '1 Fixture Street',
        wardName: 'Fixture Ward',
        districtCode: 'PRIMARY',
        districtName: 'Fixture District',
        provinceCode: `${namespace.slice(0, 8)}P`,
        provinceName: 'Fixture Province',
        countryCode: 'VN',
        serviceAreaId: primaryArea.id,
        idempotencyHash: `${namespace}-${number}`,
        requestFingerprint: `${namespace}-${number}`,
        items: {
          create: {
            productVariantId: variant.id,
            productName: 'Fixture installation product',
            variantName: 'Fixture variant',
            sku: `${namespace.slice(0, 20).toUpperCase()}-SKU`,
            quantity: 1,
            deviceUnitPrice: 1_000_000,
            serviceUnitPrice: 0,
            unitPrice: 1_000_000,
            lineTotal: 1_000_000,
          },
        },
        payment: {
          create: {
            method: PaymentMethod.COD,
            status: options.paymentStatus ?? PaymentStatus.PAID,
            amount: 1_000_000,
            referenceCode: `PAY-${namespace.toUpperCase()}-${number}`,
          },
        },
      },
      include: { items: { select: { id: true } }, payment: true },
    });
    if (!order.payment) throw new Error('Fixture payment was not created.');
    const lifecycleAt = new Date();
    await client.inventoryAllocation.create({
      data: {
        orderItemId: order.items[0].id,
        productVariantId: variant.id,
        quantity: 1,
        status: inventoryStatus,
        ...(inventoryStatus === InventoryDisposition.CONSUMED
          ? { consumedAt: lifecycleAt }
          : {}),
        ...(inventoryStatus === InventoryDisposition.RELEASED
          ? { releasedAt: lifecycleAt }
          : {}),
      },
    });
    if (inventoryStatus === InventoryDisposition.RESERVED)
      await client.inventory.update({
        where: { productVariantId: variant.id },
        data: { reserved: { increment: 1 } },
      });
    if (inventoryStatus === InventoryDisposition.CONSUMED)
      await client.inventory.update({
        where: { productVariantId: variant.id },
        data: { onHand: { decrement: 1 } },
      });
    const appointment = await client.installationAppointment.create({
      data: {
        orderId: order.id,
        serviceAreaId: primaryArea.id,
        slotId: slot.id,
        status: options.status ?? AppointmentStatus.ASSIGNMENT_PENDING,
        scheduledStartAt: slot.startsAt,
        scheduledEndAt: slot.endsAt,
      },
    });
    let assignmentId: string | undefined;
    if (options.assignedTechnician) {
      const assignment = await client.technicianAssignment.create({
        data: {
          appointmentId: appointment.id,
          technicianId: options.assignedTechnician.technicianId,
          status: AssignmentStatus.ACTIVE,
          scheduledStartAt: slot.startsAt,
          scheduledEndAt: slot.endsAt,
        },
      });
      assignmentId = assignment.id;
    }
    return {
      ...appointment,
      orderNumber: order.orderNumber,
      orderItemId: order.items[0].id,
      paymentId: order.payment.id,
      paymentVersion: order.payment.version,
      assignmentId,
    };
  }

  const pendingSlot = await createSlot(0, 1, 1);
  const pending = await createAppointment({ slot: pendingSlot });
  const assignedSlot = await createSlot(2, 2, 2);
  const assigned = await createAppointment({
    slot: assignedSlot,
    status: AppointmentStatus.ASSIGNED,
    assignedTechnician: technicianA,
  });
  const overlapping = await createAppointment({ slot: assignedSlot });
  const validRescheduleTarget = await createSlot(4, 1, 0);
  const fullRescheduleTarget = await createSlot(6, 1, 1);
  const fullSlot = await createAppointment({ slot: fullRescheduleTarget });
  const concurrentRescheduleTarget = await createSlot(8, 1, 0);
  async function createWarranty(
    orderItemId: string,
    customer: FixtureUser = customerA,
  ): Promise<string> {
    const warrantyStartsAt = new Date();
    const warrantyExpiresAt = new Date(warrantyStartsAt);
    warrantyExpiresAt.setUTCFullYear(warrantyExpiresAt.getUTCFullYear() + 1);
    const warranty = await client.warrantyRequest.create({
      data: {
        requestNumber: `${namespace.toUpperCase()}-WARRANTY-${randomUUID().slice(0, 8)}`,
        orderItemId,
        customerUserId: customer.id,
        coverageType: 'DEVICE',
        issueType: 'Fixture issue',
        description: 'Created only for pagination and Operations tests.',
        contactPhone: '0900000000',
        warrantyStartsAt,
        warrantyExpiresAt,
        assignedStaffUserId: staff.id,
      },
    });
    return warranty.id;
  }
  const warrantyRequestId = await createWarranty(pending.orderItemId);
  await client.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: 'operations.fixture-created',
      targetType: 'installation_appointment',
      targetId: pending.id,
      before: {},
      after: { namespace },
      requestId: `${namespace}-fixture`,
    },
  });

  if (!assigned.assignmentId)
    throw new Error('Fixture assignment was not created.');
  return {
    namespace,
    users: {
      admin,
      manager,
      staff,
      customerA,
      customerB,
      technicianA,
      technicianB,
      outOfAreaTechnician,
      inactiveTechnician,
    },
    serviceAreas: { primaryId: primaryArea.id, secondaryId: secondaryArea.id },
    slots: {
      pending: pendingSlot,
      assigned: assignedSlot,
      validRescheduleTarget,
      fullRescheduleTarget,
      concurrentRescheduleTarget,
    },
    appointments: {
      pending,
      assigned: { ...assigned, assignmentId: assigned.assignmentId },
      overlapping,
      fullSlot,
    },
    warrantyRequestId,
    createSlot,
    createAppointment,
    createWarranty,
    cleanup: () => cleanupOperationsFixtureNamespace(namespace, client),
  };
}
