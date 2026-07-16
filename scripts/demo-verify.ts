import { PrismaClient } from '@prisma/client';

import { createEvidenceStorage } from '../src/modules/storage/storage-factory';
import { assertLocalDemoRuntime } from './demo-runtime';

const prisma = new PrismaClient();
const demoEmails = [
  'customer@example.com',
  'admin@example.com',
  'manager@example.com',
  'technician1@example.com',
  'technician2@example.com',
];

async function main() {
  assertLocalDemoRuntime(process.env, { destructive: false });
  const [marker, users, products, orders, appointments, evidence, auditCount] =
    await Promise.all([
      prisma.bootstrapMarker.findUnique({ where: { id: 'local-demo' } }),
      prisma.user.count({ where: { email: { in: demoEmails } } }),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.order.findMany({
        where: { orderNumber: { startsWith: '247H-OPS-' } },
        distinct: ['status'],
        select: { status: true },
      }),
      prisma.installationAppointment.findMany({
        where: { order: { orderNumber: { startsWith: '247H-OPS-' } } },
        distinct: ['status'],
        select: { status: true },
      }),
      prisma.installationEvidence.findMany({
        where: {
          assignment: {
            appointment: { order: { orderNumber: '247H-OPS-TECH-DEMO' } },
          },
        },
        select: { storageKey: true },
      }),
      prisma.auditLog.count({
        where: { requestId: { startsWith: 'local-demo-' } },
      }),
    ]);
  if (!marker) throw new Error('Local demo marker is missing.');
  if (users !== demoEmails.length)
    throw new Error('Demo accounts are missing.');
  if (products < 10)
    throw new Error('At least 10 active demo products are required.');
  if (orders.length < 2) throw new Error('Demo orders need multiple states.');
  if (appointments.length < 2)
    throw new Error('Demo appointments need multiple states.');
  if (evidence.length < 1)
    throw new Error('Demo evidence metadata is missing.');
  if (auditCount < 2) throw new Error('Demo audit history is incomplete.');

  const storage = createEvidenceStorage(process.env);
  const storageChecks = await Promise.all(
    evidence.map(({ storageKey }) => storage.exists(storageKey)),
  );
  if (storageChecks.some((exists) => !exists))
    throw new Error('Demo evidence object is missing from storage.');
  process.stdout.write(
    `Demo verified: ${users} accounts, ${products} products, ${orders.length} order states, ${appointments.length} appointment states, ${evidence.length} evidence object(s), ${auditCount} audit event(s).\n`,
  );
}

void main().finally(() => prisma.$disconnect());
