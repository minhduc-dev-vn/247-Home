import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { createHash } from 'node:crypto';

const roleCodes = [
  'CUSTOMER',
  'STAFF',
  'TECHNICIAN',
  'MANAGER',
  'ADMIN',
] as const;
const demoPassword = 'LocalDemoOnly-247Home';

function deterministicSeedCuid(scope: string, value: string) {
  return `c${createHash('sha256').update(`${scope}:${value}`).digest('hex').slice(0, 24)}`;
}

const demoProducts = [
  [
    'camera-ngoai-troi-c1',
    'Camera ngoai troi C1',
    'Camera giam sat ngoai troi, quan sat ngay dem.',
    'SECURITY_CAMERA',
    'CAM-C1-WHT',
    'Ban tieu chuan',
    1290000,
    18,
  ],
  [
    'camera-trong-nha-c2',
    'Camera trong nha C2',
    'Camera quay quet cho khong gian trong nha.',
    'SECURITY_CAMERA',
    'CAM-C2-WHT',
    'Ban quay quet',
    990000,
    12,
  ],
  [
    'camera-pin-c3',
    'Camera pin C3',
    'Camera khong day dung pin, de lap dat.',
    'SECURITY_CAMERA',
    'CAM-C3-BLK',
    'Ban dung pin',
    1890000,
    8,
  ],
  [
    'chuong-cua-d1',
    'Chuong cua D1',
    'Chuong cua co hinh ket noi Wi-Fi.',
    'VIDEO_DOORBELL',
    'DB-D1-WHT',
    'Ban co chuong',
    1590000,
    9,
  ],
  [
    'chuong-cua-d2',
    'Chuong cua D2',
    'Chuong cua co hinh goc rong va dam thoai.',
    'VIDEO_DOORBELL',
    'DB-D2-BLK',
    'Ban goc rong',
    2390000,
    0,
  ],
  [
    'chuong-cua-d3',
    'Chuong cua D3',
    'Chuong cua co hinh kem man hinh trong nha.',
    'VIDEO_DOORBELL',
    'DB-D3-GRY',
    'Ban kem man hinh',
    3290000,
    6,
  ],
  [
    'mesh-wifi-m1',
    'Mesh Wi-Fi M1',
    'Bo phat Mesh Wi-Fi cho can ho nho.',
    'MESH_WIFI',
    'MESH-M1-2P',
    'Bo 2 cuc',
    1790000,
    25,
  ],
  [
    'mesh-wifi-m2',
    'Mesh Wi-Fi M2',
    'Bo phat Mesh Wi-Fi phu song nha pho.',
    'MESH_WIFI',
    'MESH-M2-3P',
    'Bo 3 cuc',
    2790000,
    16,
  ],
  [
    'mesh-wifi-m3',
    'Mesh Wi-Fi M3',
    'Mesh Wi-Fi hieu nang cao cho biet thu.',
    'MESH_WIFI',
    'MESH-M3-3P',
    'Bo 3 cuc Pro',
    4290000,
    5,
  ],
  [
    'khoa-cua-l1',
    'Khoa cua L1',
    'Khoa cua thong minh mo bang ma so.',
    'SMART_LOCK',
    'LOCK-L1-BLK',
    'Ban ma so',
    2490000,
    11,
  ],
  [
    'khoa-cua-l2',
    'Khoa cua L2',
    'Khoa cua van tay cho can ho.',
    'SMART_LOCK',
    'LOCK-L2-BLK',
    'Ban van tay',
    3490000,
    7,
  ],
  [
    'khoa-cua-l3',
    'Khoa cua L3',
    'Khoa cua thong minh cao cap ket noi app.',
    'SMART_LOCK',
    'LOCK-L3-GRY',
    'Ban ket noi app',
    4890000,
    4,
  ],
] as const;

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Seed data is only available in development and test environments.',
    );
  }

  await prisma.bootstrapMarker.upsert({
    where: { id: 'local-demo' },
    create: {
      id: 'local-demo',
      label: '247 Home local demo marker',
    },
    update: {
      label: '247 Home local demo marker',
    },
  });

  await Promise.all(
    roleCodes.map((code) =>
      prisma.role.upsert({ where: { code }, create: { code }, update: {} }),
    ),
  );

  const passwordHash = await hash(demoPassword, 12);
  const [adminRole, customerRole, technicianRole, managerRole, staffRole] =
    await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } }),
      prisma.role.findUniqueOrThrow({ where: { code: 'CUSTOMER' } }),
      prisma.role.findUniqueOrThrow({ where: { code: 'TECHNICIAN' } }),
      prisma.role.findUniqueOrThrow({ where: { code: 'MANAGER' } }),
      prisma.role.findUniqueOrThrow({ where: { code: 'STAFF' } }),
    ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    create: {
      email: 'admin@example.com',
      name: 'Local Demo Admin',
      passwordHash,
      roles: { create: { roleId: adminRole.id } },
    },
    update: { name: 'Local Demo Admin', passwordHash, isActive: true },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    create: {
      email: 'customer@example.com',
      name: 'Local Demo Customer',
      passwordHash,
      roles: { create: { roleId: customerRole.id } },
    },
    update: { name: 'Local Demo Customer', passwordHash, isActive: true },
  });
  const manager = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    create: {
      email: 'manager@example.com',
      name: 'Local Demo Manager',
      passwordHash,
      roles: { create: { roleId: managerRole.id } },
    },
    update: { name: 'Local Demo Manager', passwordHash, isActive: true },
  });
  const staff = await prisma.user.upsert({
    where: { email: 'staff@example.com' },
    create: {
      email: 'staff@example.com',
      name: 'Local Demo Staff',
      passwordHash,
      roles: { create: { roleId: staffRole.id } },
    },
    update: { name: 'Local Demo Staff', passwordHash, isActive: true },
  });
  const technician = await prisma.user.upsert({
    where: { email: 'technician1@example.com' },
    create: {
      email: 'technician1@example.com',
      name: 'Local Demo Technician One',
      passwordHash,
      roles: { create: { roleId: technicianRole.id } },
    },
    update: {
      name: 'Local Demo Technician One',
      passwordHash,
      isActive: true,
    },
  });
  const technicianTwo = await prisma.user.upsert({
    where: { email: 'technician2@example.com' },
    create: {
      email: 'technician2@example.com',
      name: 'Local Demo Technician Two',
      passwordHash,
      roles: { create: { roleId: technicianRole.id } },
    },
    update: { name: 'Local Demo Technician Two', passwordHash, isActive: true },
  });

  await Promise.all([
    prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      create: { userId: admin.id, roleId: adminRole.id },
      update: {},
    }),
    prisma.userRole.upsert({
      where: { userId_roleId: { userId: manager.id, roleId: managerRole.id } },
      create: { userId: manager.id, roleId: managerRole.id },
      update: {},
    }),
    prisma.userRole.upsert({
      where: { userId_roleId: { userId: staff.id, roleId: staffRole.id } },
      create: { userId: staff.id, roleId: staffRole.id },
      update: {},
    }),
    prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: customer.id, roleId: customerRole.id },
      },
      create: { userId: customer.id, roleId: customerRole.id },
      update: {},
    }),
    prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: technician.id, roleId: technicianRole.id },
      },
      create: { userId: technician.id, roleId: technicianRole.id },
      update: {},
    }),
    prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: technicianTwo.id, roleId: technicianRole.id },
      },
      create: { userId: technicianTwo.id, roleId: technicianRole.id },
      update: {},
    }),
  ]);
  const technicianProfile = await prisma.technician.upsert({
    where: { userId: technician.id },
    create: { userId: technician.id },
    update: { isActive: true },
  });
  const technicianTwoProfile = await prisma.technician.upsert({
    where: { userId: technicianTwo.id },
    create: { userId: technicianTwo.id },
    update: { isActive: true },
  });

  const variants = await Promise.all(
    demoProducts.map(
      async ([
        slug,
        name,
        description,
        category,
        sku,
        variantName,
        priceVnd,
        onHand,
      ]) => {
        const product = await prisma.product.upsert({
          where: { slug },
          create: { slug, name, description, category, status: 'ACTIVE' },
          update: { name, description, category, status: 'ACTIVE' },
        });
        const variant = await prisma.productVariant.upsert({
          where: { sku },
          create: {
            productId: product.id,
            sku,
            name: variantName,
            priceVnd,
            isActive: true,
          },
          update: {
            productId: product.id,
            name: variantName,
            priceVnd,
            isActive: true,
          },
        });
        await prisma.inventory.upsert({
          where: { productVariantId: variant.id },
          create: {
            productVariantId: variant.id,
            onHand,
            reserved: 0,
            version: 1,
          },
          // Seed reruns must not overwrite mutable stock or active reservations.
          update: {},
        });
        return variant;
      },
    ),
  );

  const packages = [
    [
      variants[0],
      'Lap dat Camera co ban',
      'Lap dat mot camera tai vi tri co san nguon.',
      250000,
    ],
    [
      variants[3],
      'Lap dat chuong cua',
      'Lap dat chuong cua va kiem tra ket noi Wi-Fi.',
      300000,
    ],
    [
      variants[6],
      'Cau hinh Mesh tai nha',
      'Cau hinh va toi uu vi tri cho bo Mesh Wi-Fi.',
      350000,
    ],
    [
      variants[9],
      'Lap dat khoa cua',
      'Lap dat khoa cua va huong dan su dung.',
      450000,
    ],
  ] as const;
  const seededPackages = await Promise.all(
    packages.map(async ([variant, name, description, priceVnd]) => {
      const id = deterministicSeedCuid('service-package', variant.sku);
      const legacyId = `seed-${variant.sku}`;
      const [currentPackage, legacyPackage] = await Promise.all([
        prisma.servicePackage.findUnique({
          where: { id },
          select: { id: true },
        }),
        prisma.servicePackage.findUnique({
          where: { id: legacyId },
          select: { id: true },
        }),
      ]);

      if (!currentPackage && legacyPackage) {
        await prisma.servicePackage.update({
          where: { id: legacyId },
          data: { id },
        });
      } else if (currentPackage && legacyPackage) {
        await prisma.servicePackage.update({
          where: { id: legacyId },
          data: { isActive: false },
        });
      }

      return prisma.servicePackage.upsert({
        where: { id },
        create: {
          id,
          productVariantId: variant.id,
          name,
          description,
          priceVnd,
        },
        update: {
          productVariantId: variant.id,
          name,
          description,
          priceVnd,
          isActive: true,
        },
      });
    }),
  );

  const areas = [
    ['HCM-Q1', 'HCM', 'Ho Chi Minh', 'Q1', 'Quan 1', 250000, 30000],
    ['HCM-TD', 'HCM', 'Ho Chi Minh', 'TD', 'Thu Duc', 300000, 40000],
    ['HN-CG', 'HN', 'Ha Noi', 'CG', 'Cau Giay', 300000, 40000],
    [
      'HCM-OPS-DEMO',
      'HCM',
      'Ho Chi Minh',
      'OPS-DEMO',
      'Operations Demo',
      250000,
      30000,
    ],
  ] as const;
  const seededAreas = await Promise.all(
    areas.map(
      ([
        code,
        provinceCode,
        provinceName,
        districtCode,
        districtName,
        installationFee,
        shippingFee,
      ]) =>
        prisma.serviceArea.upsert({
          where: { code },
          create: {
            code,
            provinceCode,
            provinceName,
            districtCode,
            districtName,
            installationFee,
            shippingFee,
          },
          update: {
            provinceCode,
            provinceName,
            districtCode,
            districtName,
            installationFee,
            shippingFee,
            isActive: true,
          },
        }),
    ),
  );

  await prisma.technicianServiceArea.createMany({
    data: [
      { technicianId: technicianProfile.id, serviceAreaId: seededAreas[0].id },
      { technicianId: technicianProfile.id, serviceAreaId: seededAreas[1].id },
      {
        technicianId: technicianTwoProfile.id,
        serviceAreaId: seededAreas[0].id,
      },
      {
        technicianId: technicianTwoProfile.id,
        serviceAreaId: seededAreas[2].id,
      },
      { technicianId: technicianProfile.id, serviceAreaId: seededAreas[3].id },
      {
        technicianId: technicianTwoProfile.id,
        serviceAreaId: seededAreas[3].id,
      },
    ],
    skipDuplicates: true,
  });

  const slotStart = new Date('2035-01-15T02:00:00.000Z');
  const seededSlots = await Promise.all(
    seededAreas.flatMap((area) =>
      [0, 1].map((offset) => {
        const startsAt = new Date(slotStart);
        startsAt.setUTCDate(startsAt.getUTCDate() + offset);
        const endsAt = new Date(startsAt);
        endsAt.setUTCHours(endsAt.getUTCHours() + 2);
        return prisma.installationSlot.upsert({
          where: {
            serviceAreaId_startsAt_endsAt: {
              serviceAreaId: area.id,
              startsAt,
              endsAt,
            },
          },
          create: { serviceAreaId: area.id, startsAt, endsAt, capacity: 2 },
          update: { isActive: true, capacity: 2 },
        });
      }),
    ),
  );
  const operationsArea = seededAreas[3];
  const operationsSlots = seededSlots.filter(
    ({ serviceAreaId }) => serviceAreaId === operationsArea.id,
  );
  if (operationsSlots.length !== 2) {
    throw new Error('Operations seed slots were not created as expected.');
  }
  const demoVariant = variants[0];
  const demoPackage = seededPackages[0];
  const demoDevicePrice = demoVariant.priceVnd;
  const demoServicePrice = demoPackage.priceVnd;
  const demoLineTotal = demoDevicePrice + demoServicePrice;
  const demoInstallationFee = operationsArea.installationFee;
  const demoShippingFee = operationsArea.shippingFee;
  const demoGrandTotal = demoLineTotal + demoInstallationFee + demoShippingFee;
  const demoConsumedAt = new Date('2025-01-01T00:00:00.000Z');

  const demoOrder = await prisma.order.upsert({
    where: { orderNumber: '247H-OPS-DEMO' },
    create: {
      orderNumber: '247H-OPS-DEMO',
      userId: customer.id,
      status: 'READY_FOR_INSTALLATION',
      inventoryStatus: 'CONSUMED',
      subtotal: demoLineTotal,
      installationFee: demoInstallationFee,
      shippingFee: demoShippingFee,
      grandTotal: demoGrandTotal,
      recipientName: 'Operations Demo',
      recipientPhone: '0900000000',
      addressLine1: '1 Test Street',
      wardName: 'Ben Nghe',
      districtCode: 'OPS-DEMO',
      districtName: 'Operations Demo',
      provinceCode: 'HCM',
      provinceName: 'Ho Chi Minh',
      countryCode: 'VN',
      serviceAreaId: operationsArea.id,
      idempotencyHash: 'operations-demo-seed',
      requestFingerprint: 'operations-demo-seed',
    },
    update: {
      status: 'READY_FOR_INSTALLATION',
      inventoryStatus: 'CONSUMED',
      subtotal: demoLineTotal,
      installationFee: demoInstallationFee,
      shippingFee: demoShippingFee,
      grandTotal: demoGrandTotal,
      districtCode: 'OPS-DEMO',
      districtName: 'Operations Demo',
      provinceCode: 'HCM',
      provinceName: 'Ho Chi Minh',
      serviceAreaId: operationsArea.id,
      version: 1,
    },
  });
  const demoOrderItem = await prisma.orderItem.upsert({
    where: { id: 'seed-ops-demo-item' },
    create: {
      id: 'seed-ops-demo-item',
      orderId: demoOrder.id,
      productVariantId: demoVariant.id,
      servicePackageId: demoPackage.id,
      productName: demoProducts[0][1],
      variantName: demoVariant.name,
      sku: demoVariant.sku,
      servicePackageName: demoPackage.name,
      quantity: 1,
      deviceUnitPrice: demoDevicePrice,
      serviceUnitPrice: demoServicePrice,
      unitPrice: demoLineTotal,
      lineTotal: demoLineTotal,
    },
    update: {
      orderId: demoOrder.id,
      productVariantId: demoVariant.id,
      servicePackageId: demoPackage.id,
      productName: demoProducts[0][1],
      variantName: demoVariant.name,
      sku: demoVariant.sku,
      servicePackageName: demoPackage.name,
      quantity: 1,
      deviceUnitPrice: demoDevicePrice,
      serviceUnitPrice: demoServicePrice,
      unitPrice: demoLineTotal,
      lineTotal: demoLineTotal,
    },
  });
  await prisma.inventoryAllocation.upsert({
    where: { orderItemId: demoOrderItem.id },
    create: {
      id: 'seed-ops-demo-allocation',
      orderItemId: demoOrderItem.id,
      productVariantId: demoVariant.id,
      quantity: 1,
      status: 'CONSUMED',
      reservedAt: demoConsumedAt,
      consumedAt: demoConsumedAt,
    },
    update: {
      productVariantId: demoVariant.id,
      quantity: 1,
      status: 'CONSUMED',
      consumedAt: demoConsumedAt,
      releasedAt: null,
    },
  });
  const demoAppointment = await prisma.installationAppointment.upsert({
    where: { orderId: demoOrder.id },
    create: {
      orderId: demoOrder.id,
      serviceAreaId: operationsArea.id,
      slotId: operationsSlots[0].id,
      status: 'ASSIGNMENT_PENDING',
      scheduledStartAt: operationsSlots[0].startsAt,
      scheduledEndAt: operationsSlots[0].endsAt,
    },
    update: {
      status: 'ASSIGNMENT_PENDING',
      version: 1,
      serviceAreaId: operationsArea.id,
      slotId: operationsSlots[0].id,
      scheduledStartAt: operationsSlots[0].startsAt,
      scheduledEndAt: operationsSlots[0].endsAt,
      capacityReleasedAt: null,
    },
  });
  await prisma.technicianAssignment.updateMany({
    where: { appointmentId: demoAppointment.id, status: 'ACTIVE' },
    data: { status: 'CANCELLED' },
  });
  await prisma.payment.upsert({
    where: { orderId: demoOrder.id },
    create: {
      orderId: demoOrder.id,
      method: 'COD',
      status: 'PAID',
      amount: demoGrandTotal,
      referenceCode: 'PAY-OPS-DEMO',
    },
    update: { status: 'PAID', amount: demoGrandTotal, currency: 'VND' },
  });
  const technicianDemoOrder = await prisma.order.upsert({
    where: { orderNumber: '247H-OPS-TECH-DEMO' },
    create: {
      orderNumber: '247H-OPS-TECH-DEMO',
      userId: customer.id,
      status: 'READY_FOR_INSTALLATION',
      inventoryStatus: 'CONSUMED',
      subtotal: demoLineTotal,
      installationFee: demoInstallationFee,
      shippingFee: demoShippingFee,
      grandTotal: demoGrandTotal,
      recipientName: 'Technician Demo',
      recipientPhone: '0900000000',
      addressLine1: '2 Test Street',
      wardName: 'Ben Nghe',
      districtCode: 'OPS-DEMO',
      districtName: 'Operations Demo',
      provinceCode: 'HCM',
      provinceName: 'Ho Chi Minh',
      countryCode: 'VN',
      serviceAreaId: operationsArea.id,
      idempotencyHash: 'operations-tech-demo-seed',
      requestFingerprint: 'operations-tech-demo-seed',
    },
    update: {
      status: 'READY_FOR_INSTALLATION',
      inventoryStatus: 'CONSUMED',
      subtotal: demoLineTotal,
      installationFee: demoInstallationFee,
      shippingFee: demoShippingFee,
      grandTotal: demoGrandTotal,
      districtCode: 'OPS-DEMO',
      districtName: 'Operations Demo',
      provinceCode: 'HCM',
      provinceName: 'Ho Chi Minh',
      serviceAreaId: operationsArea.id,
      version: 1,
    },
  });
  const technicianDemoOrderItem = await prisma.orderItem.upsert({
    where: { id: 'seed-ops-tech-demo-item' },
    create: {
      id: 'seed-ops-tech-demo-item',
      orderId: technicianDemoOrder.id,
      productVariantId: demoVariant.id,
      servicePackageId: demoPackage.id,
      productName: demoProducts[0][1],
      variantName: demoVariant.name,
      sku: demoVariant.sku,
      servicePackageName: demoPackage.name,
      quantity: 1,
      deviceUnitPrice: demoDevicePrice,
      serviceUnitPrice: demoServicePrice,
      unitPrice: demoLineTotal,
      lineTotal: demoLineTotal,
    },
    update: {
      orderId: technicianDemoOrder.id,
      productVariantId: demoVariant.id,
      servicePackageId: demoPackage.id,
      productName: demoProducts[0][1],
      variantName: demoVariant.name,
      sku: demoVariant.sku,
      servicePackageName: demoPackage.name,
      quantity: 1,
      deviceUnitPrice: demoDevicePrice,
      serviceUnitPrice: demoServicePrice,
      unitPrice: demoLineTotal,
      lineTotal: demoLineTotal,
    },
  });
  await prisma.inventoryAllocation.upsert({
    where: { orderItemId: technicianDemoOrderItem.id },
    create: {
      id: 'seed-ops-tech-demo-allocation',
      orderItemId: technicianDemoOrderItem.id,
      productVariantId: demoVariant.id,
      quantity: 1,
      status: 'CONSUMED',
      reservedAt: demoConsumedAt,
      consumedAt: demoConsumedAt,
    },
    update: {
      productVariantId: demoVariant.id,
      quantity: 1,
      status: 'CONSUMED',
      consumedAt: demoConsumedAt,
      releasedAt: null,
    },
  });
  const technicianDemoAppointment = await prisma.installationAppointment.upsert(
    {
      where: { orderId: technicianDemoOrder.id },
      create: {
        orderId: technicianDemoOrder.id,
        serviceAreaId: operationsArea.id,
        slotId: operationsSlots[1].id,
        status: 'ASSIGNED',
        scheduledStartAt: operationsSlots[1].startsAt,
        scheduledEndAt: operationsSlots[1].endsAt,
      },
      update: {
        status: 'ASSIGNED',
        version: 1,
        serviceAreaId: operationsArea.id,
        slotId: operationsSlots[1].id,
        scheduledStartAt: operationsSlots[1].startsAt,
        scheduledEndAt: operationsSlots[1].endsAt,
        capacityReleasedAt: null,
      },
    },
  );
  const activeTechnicianDemoAssignment =
    await prisma.technicianAssignment.findFirst({
      where: {
        appointmentId: technicianDemoAppointment.id,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
  const technicianDemoAssignment = activeTechnicianDemoAssignment
    ? await prisma.technicianAssignment.update({
        where: { id: activeTechnicianDemoAssignment.id },
        data: {
          technicianId: technicianProfile.id,
          status: 'ACTIVE',
          completionNote: null,
          assignedAt: new Date(),
          acceptedAt: null,
          enRouteAt: null,
          arrivedAt: null,
          startedAt: null,
          completedAt: null,
          scheduledStartAt: operationsSlots[1].startsAt,
          scheduledEndAt: operationsSlots[1].endsAt,
        },
      })
    : await prisma.technicianAssignment.create({
        data: {
          appointmentId: technicianDemoAppointment.id,
          technicianId: technicianProfile.id,
          scheduledStartAt: operationsSlots[1].startsAt,
          scheduledEndAt: operationsSlots[1].endsAt,
        },
      });
  await prisma.payment.upsert({
    where: { orderId: technicianDemoOrder.id },
    create: {
      orderId: technicianDemoOrder.id,
      method: 'COD',
      status: 'PAID',
      amount: demoGrandTotal,
      referenceCode: 'PAY-OPS-TECH-DEMO',
    },
    update: { status: 'PAID', amount: demoGrandTotal, currency: 'VND' },
  });

  await prisma.auditLog.upsert({
    where: { id: deterministicSeedCuid('audit', 'operations-assignment') },
    create: {
      id: deterministicSeedCuid('audit', 'operations-assignment'),
      actorUserId: manager.id,
      action: 'operations.appointment-assigned',
      targetType: 'technician_assignment',
      targetId: technicianDemoAssignment.id,
      before: { appointmentStatus: 'ASSIGNMENT_PENDING' },
      after: {
        appointmentStatus: 'ASSIGNED',
        technicianId: technicianProfile.id,
      },
      reason: 'Synthetic local demo assignment',
      requestId: 'local-demo-assignment-seed',
    },
    update: {
      actorUserId: manager.id,
      targetId: technicianDemoAssignment.id,
      after: {
        appointmentStatus: 'ASSIGNED',
        technicianId: technicianProfile.id,
      },
    },
  });

  const cancelledAt = new Date('2025-01-02T00:00:00.000Z');
  const cancelledOrder = await prisma.order.upsert({
    where: { orderNumber: '247H-OPS-CANCELLED-DEMO' },
    create: {
      orderNumber: '247H-OPS-CANCELLED-DEMO',
      userId: customer.id,
      status: 'CANCELLED',
      inventoryStatus: 'RELEASED',
      subtotal: demoLineTotal,
      installationFee: demoInstallationFee,
      shippingFee: demoShippingFee,
      grandTotal: demoGrandTotal,
      recipientName: 'Cancelled Demo',
      recipientPhone: '0900000000',
      addressLine1: '3 Test Street',
      wardName: 'Ben Nghe',
      districtCode: 'OPS-DEMO',
      districtName: 'Operations Demo',
      provinceCode: 'HCM',
      provinceName: 'Ho Chi Minh',
      countryCode: 'VN',
      serviceAreaId: operationsArea.id,
      idempotencyHash: 'operations-cancelled-demo-seed',
      requestFingerprint: 'operations-cancelled-demo-seed',
      cancellationReason: 'Synthetic local demo cancellation',
      cancelledAt,
    },
    update: {
      status: 'CANCELLED',
      inventoryStatus: 'RELEASED',
      cancellationReason: 'Synthetic local demo cancellation',
      cancelledAt,
      version: 1,
    },
  });
  const cancelledOrderItem = await prisma.orderItem.upsert({
    where: { id: 'seed-ops-cancelled-demo-item' },
    create: {
      id: 'seed-ops-cancelled-demo-item',
      orderId: cancelledOrder.id,
      productVariantId: demoVariant.id,
      servicePackageId: demoPackage.id,
      productName: demoProducts[0][1],
      variantName: demoVariant.name,
      sku: demoVariant.sku,
      servicePackageName: demoPackage.name,
      quantity: 1,
      deviceUnitPrice: demoDevicePrice,
      serviceUnitPrice: demoServicePrice,
      unitPrice: demoLineTotal,
      lineTotal: demoLineTotal,
    },
    update: {
      orderId: cancelledOrder.id,
      productVariantId: demoVariant.id,
      servicePackageId: demoPackage.id,
      productName: demoProducts[0][1],
      variantName: demoVariant.name,
      sku: demoVariant.sku,
      servicePackageName: demoPackage.name,
      quantity: 1,
      deviceUnitPrice: demoDevicePrice,
      serviceUnitPrice: demoServicePrice,
      unitPrice: demoLineTotal,
      lineTotal: demoLineTotal,
    },
  });
  await prisma.inventoryAllocation.upsert({
    where: { orderItemId: cancelledOrderItem.id },
    create: {
      id: 'seed-ops-cancelled-demo-allocation',
      orderItemId: cancelledOrderItem.id,
      productVariantId: demoVariant.id,
      quantity: 1,
      status: 'RELEASED',
      reservedAt: demoConsumedAt,
      releasedAt: cancelledAt,
    },
    update: {
      productVariantId: demoVariant.id,
      quantity: 1,
      status: 'RELEASED',
      consumedAt: null,
      releasedAt: cancelledAt,
    },
  });
  await prisma.payment.upsert({
    where: { orderId: cancelledOrder.id },
    create: {
      orderId: cancelledOrder.id,
      method: 'COD',
      status: 'CANCELLED',
      amount: demoGrandTotal,
      referenceCode: 'PAY-OPS-CANCELLED-DEMO',
    },
    update: {
      status: 'CANCELLED',
      amount: demoGrandTotal,
      currency: 'VND',
    },
  });
  await prisma.auditLog.upsert({
    where: { id: deterministicSeedCuid('audit', 'cancelled-order') },
    create: {
      id: deterministicSeedCuid('audit', 'cancelled-order'),
      actorUserId: manager.id,
      action: 'order.cancelled',
      targetType: 'order',
      targetId: cancelledOrder.id,
      before: { status: 'PENDING_CONFIRMATION' },
      after: { status: 'CANCELLED', inventoryStatus: 'RELEASED' },
      reason: 'Synthetic local demo cancellation',
      requestId: 'local-demo-cancelled-order-seed',
    },
    update: {
      actorUserId: manager.id,
      targetId: cancelledOrder.id,
    },
  });

  const slotsToReconcile = await prisma.installationSlot.findMany({
    where: { serviceAreaId: operationsArea.id },
    select: { id: true, capacity: true },
  });
  const appointmentCounts = await prisma.installationAppointment.groupBy({
    by: ['slotId'],
    where: {
      slotId: { in: slotsToReconcile.map(({ id }) => id) },
      capacityReleasedAt: null,
    },
    _count: { _all: true },
  });
  const countBySlot = new Map(
    appointmentCounts.map(({ slotId, _count }) => [slotId, _count._all]),
  );
  for (const slot of slotsToReconcile) {
    const bookedCount = countBySlot.get(slot.id) ?? 0;
    if (bookedCount > slot.capacity) {
      throw new Error(`Seed slot ${slot.id} exceeds its configured capacity.`);
    }
    await prisma.installationSlot.update({
      where: { id: slot.id },
      data: { bookedCount },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
