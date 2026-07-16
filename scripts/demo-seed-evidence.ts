import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

import { createEvidenceStorage } from '../src/modules/storage/storage-factory';
import { uploadAndPersist } from '../src/modules/storage/storage-interface';
import { assertLocalDemoRuntime } from './demo-runtime';

const prisma = new PrismaClient();
const evidenceId = `c${createHash('sha256').update('local-demo-evidence').digest('hex').slice(0, 24)}`;
const auditId = `c${createHash('sha256').update('local-demo-evidence-audit').digest('hex').slice(0, 24)}`;
const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function main() {
  assertLocalDemoRuntime(process.env, { destructive: false });
  const storage = createEvidenceStorage(process.env);
  const assignment = await prisma.technicianAssignment.findFirst({
    where: {
      status: 'ACTIVE',
      appointment: { order: { orderNumber: '247H-OPS-TECH-DEMO' } },
    },
    select: { id: true, technician: { select: { userId: true } } },
  });
  if (!assignment) throw new Error('Demo technician assignment is missing.');

  const existing = await prisma.installationEvidence.findUnique({
    where: { id: evidenceId },
    select: { storageKey: true },
  });
  if (existing && (await storage.exists(existing.storageKey))) {
    process.stdout.write('Demo evidence already exists.\n');
    return;
  }
  if (existing) {
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { id: auditId } }),
      prisma.installationEvidence.delete({ where: { id: evidenceId } }),
    ]);
  }

  await uploadAndPersist(
    storage,
    {
      filename: 'local-demo-evidence.png',
      contentType: 'image/png',
      contentBase64: tinyPng,
    },
    async (uploaded) =>
      prisma.$transaction(async (tx) => {
        await tx.installationEvidence.create({
          data: {
            id: evidenceId,
            assignmentId: assignment.id,
            storageKey: uploaded.storageKey,
            mimeType: uploaded.contentType,
            byteSize: uploaded.byteSize,
          },
        });
        await tx.auditLog.upsert({
          where: { id: auditId },
          create: {
            id: auditId,
            actorUserId: assignment.technician.userId,
            action: 'operations.installation-evidence-added',
            targetType: 'technician_assignment',
            targetId: assignment.id,
            before: {},
            after: {
              evidenceId,
              mimeType: uploaded.contentType,
              byteSize: uploaded.byteSize,
              checksumSha256: uploaded.checksumSha256,
            },
            reason: 'Synthetic local demo evidence',
            requestId: 'local-demo-evidence-seed',
          },
          update: {},
        });
      }),
  );
  process.stdout.write(
    'Demo evidence uploaded to private S3-compatible storage.\n',
  );
}

void main().finally(() => prisma.$disconnect());
