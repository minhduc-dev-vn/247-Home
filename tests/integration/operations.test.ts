import { readdir } from 'node:fs/promises';
import path from 'node:path';

import {
  AppointmentStatus,
  AssignmentStatus,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import {
  addEvidence,
  assignTechnician,
  getEvidencePreview,
  getTechnicianActionOptions,
  getTechnicianAssignment,
  listAudit,
  listAvailableTechnicians,
  listTechnicianAssignments,
  listWarranties,
  rescheduleAppointment,
  technicianAction,
} from '@/modules/operations';
import {
  discardLocalEvidence,
  readLocalEvidence,
  storeLocalEvidence,
} from '@/modules/operations/infrastructure/local-evidence-storage';
import {
  createOperationsFixture,
  runFailureSafeCleanup,
  type OperationsFixture,
} from '../fixtures/operations';
import { prisma } from '@/shared/db/client';

const evidenceRoot = path.join(
  process.cwd(),
  '.local-uploads',
  'installation-evidence',
);
const validPng = 'iVBORw0KGgo=';

async function evidenceFiles(): Promise<string[]> {
  try {
    return (await readdir(evidenceRoot, { recursive: true }))
      .filter((entry) => entry !== '.tmp')
      .sort();
  } catch {
    return [];
  }
}

async function withFixture(run: (fixture: OperationsFixture) => Promise<void>) {
  const fixture = await createOperationsFixture();
  try {
    await run(fixture);
  } finally {
    await fixture.cleanup();
  }
}

describe.sequential('Operations integration fixtures and invariants', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allows a manager to assign a suitable technician and audits the assignment', async () => {
    await withFixture(async (fixture) => {
      const assignment = await assignTechnician(
        fixture.users.manager.actor,
        fixture.appointments.pending.id,
        fixture.users.technicianB.technicianId,
        fixture.appointments.pending.version,
        'Manager assignment test',
        `${fixture.namespace}-assign`,
      );
      expect(assignment.technicianId).toBe(
        fixture.users.technicianB.technicianId,
      );
      await expect(
        prisma.installationAppointment.findUniqueOrThrow({
          where: { id: fixture.appointments.pending.id },
        }),
      ).resolves.toMatchObject({ status: AppointmentStatus.ASSIGNED });
      await expect(
        prisma.auditLog.findFirstOrThrow({
          where: {
            actorUserId: fixture.users.manager.id,
            action: 'operations.technician-assigned',
            targetId: fixture.appointments.pending.id,
          },
        }),
      ).resolves.toMatchObject({
        targetType: 'installation_appointment',
        requestId: `${fixture.namespace}-assign`,
      });
    });
  });

  it('denies STAFF assignment under the manager-only policy', async () => {
    await withFixture(async (fixture) => {
      await expect(
        assignTechnician(
          fixture.users.staff.actor,
          fixture.appointments.pending.id,
          fixture.users.technicianA.technicianId,
          fixture.appointments.pending.version,
          'Staff must not assign',
          `${fixture.namespace}-staff-assign`,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  it('allows only one concurrent assignment for one appointment version', async () => {
    await withFixture(async (fixture) => {
      const requestIds = [
        `${fixture.namespace}-same-appointment-a`,
        `${fixture.namespace}-same-appointment-b`,
      ];
      const results = await Promise.allSettled([
        assignTechnician(
          fixture.users.manager.actor,
          fixture.appointments.pending.id,
          fixture.users.technicianA.technicianId,
          fixture.appointments.pending.version,
          'Concurrent same appointment A',
          requestIds[0],
        ),
        assignTechnician(
          fixture.users.manager.actor,
          fixture.appointments.pending.id,
          fixture.users.technicianB.technicianId,
          fixture.appointments.pending.version,
          'Concurrent same appointment B',
          requestIds[1],
        ),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      expect(rejected?.reason).toMatchObject({ code: 'CONFLICT' });
      await expect(
        prisma.installationAppointment.findUniqueOrThrow({
          where: { id: fixture.appointments.pending.id },
        }),
      ).resolves.toMatchObject({
        status: AppointmentStatus.ASSIGNED,
        version: fixture.appointments.pending.version + 1,
      });
      await expect(
        prisma.technicianAssignment.count({
          where: {
            appointmentId: fixture.appointments.pending.id,
            status: AssignmentStatus.ACTIVE,
          },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.auditLog.count({
          where: {
            targetId: fixture.appointments.pending.id,
            action: 'operations.technician-assigned',
            requestId: { in: requestIds },
          },
        }),
      ).resolves.toBe(1);
    });
  });

  it('hides an assignment from a different technician', async () => {
    await withFixture(async (fixture) => {
      await expect(
        getTechnicianAssignment(
          fixture.users.technicianB.actor,
          fixture.appointments.assigned.assignmentId,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        technicianAction(
          fixture.users.technicianB.actor,
          fixture.appointments.assigned.assignmentId,
          'start',
          fixture.appointments.assigned.version,
          undefined,
          `${fixture.namespace}-idor-action`,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  it('reschedules an appointment, preserves a failed request, and audits success', async () => {
    await withFixture(async (fixture) => {
      const updated = await rescheduleAppointment(
        fixture.users.manager.actor,
        fixture.appointments.pending.id,
        fixture.slots.validRescheduleTarget.id,
        fixture.appointments.pending.version,
        'Customer requested another time',
        `${fixture.namespace}-reschedule-success`,
      );
      expect(updated.slotId).toBe(fixture.slots.validRescheduleTarget.id);
      expect(updated.status).toBe(AppointmentStatus.ASSIGNMENT_PENDING);
      await expect(
        prisma.auditLog.findFirstOrThrow({
          where: {
            actorUserId: fixture.users.manager.id,
            action: 'operations.appointment-rescheduled',
            targetId: fixture.appointments.pending.id,
          },
        }),
      ).resolves.toMatchObject({
        requestId: `${fixture.namespace}-reschedule-success`,
      });

      await expect(
        rescheduleAppointment(
          fixture.users.manager.actor,
          fixture.appointments.pending.id,
          fixture.slots.fullRescheduleTarget.id,
          updated.version,
          'Attempt an unavailable slot',
          `${fixture.namespace}-reschedule-full`,
        ),
      ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
      await expect(
        prisma.installationAppointment.findUniqueOrThrow({
          where: { id: fixture.appointments.pending.id },
        }),
      ).resolves.toMatchObject({
        slotId: fixture.slots.validRescheduleTarget.id,
        version: updated.version,
      });
    });
  });

  it('rejects rescheduling an appointment into a different service area', async () => {
    await withFixture(async (fixture) => {
      const startsAt = new Date(
        fixture.slots.validRescheduleTarget.startsAt.getTime() +
          24 * 60 * 60 * 1_000,
      );
      const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1_000);
      const crossAreaSlot = await prisma.installationSlot.create({
        data: {
          serviceAreaId: fixture.serviceAreas.secondaryId,
          startsAt,
          endsAt,
          capacity: 1,
        },
      });

      await expect(
        rescheduleAppointment(
          fixture.users.manager.actor,
          fixture.appointments.pending.id,
          crossAreaSlot.id,
          fixture.appointments.pending.version,
          'Cross-area reschedule must be rejected',
          `${fixture.namespace}-cross-area-reschedule`,
        ),
      ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
      await expect(
        prisma.installationAppointment.findUniqueOrThrow({
          where: { id: fixture.appointments.pending.id },
        }),
      ).resolves.toMatchObject({
        slotId: fixture.appointments.pending.slotId,
        serviceAreaId: fixture.serviceAreas.primaryId,
        version: fixture.appointments.pending.version,
      });
      await expect(
        prisma.installationSlot.findUniqueOrThrow({
          where: { id: crossAreaSlot.id },
        }),
      ).resolves.toMatchObject({ bookedCount: 0 });
    });
  });

  it('rejects rescheduling an appointment into the past', async () => {
    await withFixture(async (fixture) => {
      const startsAt = new Date(Date.now() - 4 * 60 * 60 * 1_000);
      const pastSlot = await prisma.installationSlot.create({
        data: {
          serviceAreaId: fixture.serviceAreas.primaryId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1_000),
          capacity: 1,
        },
      });

      await expect(
        rescheduleAppointment(
          fixture.users.manager.actor,
          fixture.appointments.pending.id,
          pastSlot.id,
          fixture.appointments.pending.version,
          'Past schedules are invalid',
          `${fixture.namespace}-past-reschedule`,
        ),
      ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
      await expect(
        prisma.installationAppointment.findUniqueOrThrow({
          where: { id: fixture.appointments.pending.id },
        }),
      ).resolves.toMatchObject({
        slotId: fixture.appointments.pending.slotId,
        version: fixture.appointments.pending.version,
      });
      await expect(
        prisma.installationSlot.findUniqueOrThrow({
          where: { id: pastSlot.id },
        }),
      ).resolves.toMatchObject({ bookedCount: 0 });
    });
  });

  it('allows only one concurrent request to reserve the final slot', async () => {
    await withFixture(async (fixture) => {
      const secondSource = await fixture.createAppointment({
        slot: await fixture.createSlot(24, 1, 1),
      });
      const results = await Promise.allSettled([
        rescheduleAppointment(
          fixture.users.manager.actor,
          fixture.appointments.pending.id,
          fixture.slots.concurrentRescheduleTarget.id,
          fixture.appointments.pending.version,
          'Concurrent slot request A',
          `${fixture.namespace}-slot-a`,
        ),
        rescheduleAppointment(
          fixture.users.manager.actor,
          secondSource.id,
          fixture.slots.concurrentRescheduleTarget.id,
          secondSource.version,
          'Concurrent slot request B',
          `${fixture.namespace}-slot-b`,
        ),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      await expect(
        prisma.installationSlot.findUniqueOrThrow({
          where: { id: fixture.slots.concurrentRescheduleTarget.id },
        }),
      ).resolves.toMatchObject({ bookedCount: 1, capacity: 1 });
    });
  });

  it('lets PostgreSQL exclusion constraint reject an overlapping assignment', async () => {
    await withFixture(async (fixture) => {
      await expect(
        prisma.technicianAssignment.create({
          data: {
            appointmentId: fixture.appointments.overlapping.id,
            technicianId: fixture.users.technicianA.technicianId,
            scheduledStartAt: fixture.slots.assigned.startsAt,
            scheduledEndAt: fixture.slots.assigned.endsAt,
          },
        }),
      ).rejects.toThrow('23P01');
    });
  });

  it('audits technician start after the required arrival transition', async () => {
    await withFixture(async (fixture) => {
      const assignmentId = fixture.appointments.assigned.assignmentId;
      let version = fixture.appointments.assigned.version;
      for (const action of ['en-route', 'arrive', 'start'] as const) {
        const updated = await technicianAction(
          fixture.users.technicianA.actor,
          assignmentId,
          action,
          version,
          undefined,
          `${fixture.namespace}-${action}`,
        );
        version = updated.version;
      }
      await expect(
        prisma.auditLog.findFirstOrThrow({
          where: {
            actorUserId: fixture.users.technicianA.id,
            action: 'operations.technician-start',
            targetId: fixture.appointments.assigned.id,
          },
        }),
      ).resolves.toMatchObject({
        after: { status: AppointmentStatus.IN_PROGRESS },
      });
    });
  });

  it('audits technician completion and completes the order atomically', async () => {
    await withFixture(async (fixture) => {
      const assignmentId = fixture.appointments.assigned.assignmentId;
      let version = fixture.appointments.assigned.version;
      for (const action of ['en-route', 'arrive', 'start'] as const) {
        const updated = await technicianAction(
          fixture.users.technicianA.actor,
          assignmentId,
          action,
          version,
          undefined,
          `${fixture.namespace}-${action}`,
        );
        version = updated.version;
      }
      await technicianAction(
        fixture.users.technicianA.actor,
        assignmentId,
        'complete',
        version,
        'Fixture completion note',
        `${fixture.namespace}-complete`,
      );
      await expect(
        prisma.order.findUniqueOrThrow({
          where: { id: fixture.appointments.assigned.orderId },
        }),
      ).resolves.toMatchObject({ status: OrderStatus.COMPLETED });
      await expect(
        prisma.auditLog.findFirstOrThrow({
          where: {
            actorUserId: fixture.users.technicianA.id,
            action: 'operations.technician-complete',
            targetId: fixture.appointments.assigned.id,
          },
        }),
      ).resolves.toMatchObject({
        after: { status: AppointmentStatus.COMPLETED },
      });
    });
  });

  it('refuses technician completion when the payment is not paid', async () => {
    await withFixture(async (fixture) => {
      const assignmentId = fixture.appointments.assigned.assignmentId;
      let version = fixture.appointments.assigned.version;
      for (const action of ['en-route', 'arrive', 'start'] as const) {
        const updated = await technicianAction(
          fixture.users.technicianA.actor,
          assignmentId,
          action,
          version,
          undefined,
          `${fixture.namespace}-unpaid-${action}`,
        );
        version = updated.version;
      }
      await prisma.payment.update({
        where: { orderId: fixture.appointments.assigned.orderId },
        data: { status: PaymentStatus.PENDING },
      });

      await expect(
        technicianAction(
          fixture.users.technicianA.actor,
          assignmentId,
          'complete',
          version,
          'Attempted completion before payment',
          `${fixture.namespace}-unpaid-complete`,
        ),
      ).rejects.toMatchObject({
        code: 'INVALID_STATE_TRANSITION',
        message: 'PAYMENT_NOT_READY',
      });
      await expect(
        prisma.installationAppointment.findUniqueOrThrow({
          where: { id: fixture.appointments.assigned.id },
        }),
      ).resolves.toMatchObject({
        status: AppointmentStatus.IN_PROGRESS,
        version,
      });
      await expect(
        prisma.order.findUniqueOrThrow({
          where: { id: fixture.appointments.assigned.orderId },
        }),
      ).resolves.toMatchObject({
        status: OrderStatus.INSTALLATION_IN_PROGRESS,
      });
      await expect(
        prisma.auditLog.count({
          where: {
            action: 'operations.technician-complete',
            targetId: fixture.appointments.assigned.id,
          },
        }),
      ).resolves.toBe(0);
    });
  });

  it('returns only active technicians in the appointment service area without overlap', async () => {
    await withFixture(async (fixture) => {
      const firstPage = await listAvailableTechnicians(
        fixture.users.manager.actor,
        { appointmentId: fixture.appointments.pending.id, limit: 1 },
      );
      expect(firstPage.items).toHaveLength(1);
      expect(firstPage.nextCursor).toBeTruthy();
      const secondPage = await listAvailableTechnicians(
        fixture.users.manager.actor,
        {
          appointmentId: fixture.appointments.pending.id,
          cursor: firstPage.nextCursor!,
          limit: 1,
        },
      );
      expect(secondPage.items).toHaveLength(1);
      expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);

      const eligibleForPending = await listAvailableTechnicians(
        fixture.users.manager.actor,
        { appointmentId: fixture.appointments.pending.id, limit: 100 },
      );
      expect(
        eligibleForPending.items.map((technician) => technician.id),
      ).toEqual(
        expect.arrayContaining([
          fixture.users.technicianA.technicianId,
          fixture.users.technicianB.technicianId,
        ]),
      );
      expect(
        eligibleForPending.items.map((technician) => technician.id),
      ).not.toContain(fixture.users.outOfAreaTechnician.technicianId);
      expect(
        eligibleForPending.items.map((technician) => technician.id),
      ).not.toContain(fixture.users.inactiveTechnician.technicianId);
      expect(
        eligibleForPending.items.map((technician) => technician.user.name),
      ).toEqual(
        [...eligibleForPending.items]
          .map((technician) => technician.user.name)
          .sort((left, right) => left.localeCompare(right)),
      );
      await expect(
        listAvailableTechnicians(fixture.users.manager.actor, {
          appointmentId: fixture.appointments.pending.id,
          limit: 100,
          search: 'Technician B',
        }),
      ).resolves.toMatchObject({
        items: [
          expect.objectContaining({
            id: fixture.users.technicianB.technicianId,
          }),
        ],
      });
      const eligibleForOverlap = await listAvailableTechnicians(
        fixture.users.manager.actor,
        { appointmentId: fixture.appointments.overlapping.id, limit: 100 },
      );
      expect(
        eligibleForOverlap.items.map((technician) => technician.id),
      ).not.toContain(fixture.users.technicianA.technicianId);
    });
  });

  it('maps a concurrent technician assignment race to one conflict and one audit event', async () => {
    await withFixture(async (fixture) => {
      const competing = await fixture.createAppointment({
        slot: fixture.slots.assigned,
      });
      const appointments = [fixture.appointments.overlapping, competing];
      const results = await Promise.allSettled(
        appointments.map((appointment, index) =>
          assignTechnician(
            fixture.users.manager.actor,
            appointment.id,
            fixture.users.technicianB.technicianId,
            appointment.version,
            `Concurrent assignment ${index + 1}`,
            `${fixture.namespace}-assignment-race-${index + 1}`,
          ),
        ),
      );
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      expect(rejected?.reason).toMatchObject({ code: 'CONFLICT' });

      const persisted = await prisma.installationAppointment.findMany({
        where: { id: { in: appointments.map(({ id }) => id) } },
        select: { id: true, status: true, version: true },
      });
      expect(
        persisted.filter(({ status }) => status === AppointmentStatus.ASSIGNED),
      ).toHaveLength(1);
      expect(
        persisted.filter(
          ({ status }) => status === AppointmentStatus.ASSIGNMENT_PENDING,
        ),
      ).toHaveLength(1);
      expect(
        persisted.filter(
          ({ status }) => status === AppointmentStatus.ASSIGNED,
        )[0].version,
      ).toBe(2);
      await expect(
        prisma.auditLog.count({
          where: {
            action: 'operations.technician-assigned',
            targetId: { in: appointments.map(({ id }) => id) },
          },
        }),
      ).resolves.toBe(1);
    });
  });

  it('allows only one concurrent technician action for the same appointment version', async () => {
    await withFixture(async (fixture) => {
      const assignmentId = fixture.appointments.assigned.assignmentId;
      const expectedVersion = fixture.appointments.assigned.version;
      const results = await Promise.allSettled([
        technicianAction(
          fixture.users.technicianA.actor,
          assignmentId,
          'en-route',
          expectedVersion,
          undefined,
          `${fixture.namespace}-technician-race-a`,
        ),
        technicianAction(
          fixture.users.technicianA.actor,
          assignmentId,
          'en-route',
          expectedVersion,
          undefined,
          `${fixture.namespace}-technician-race-b`,
        ),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      expect(rejected?.reason).toMatchObject({ code: 'CONFLICT' });
      await expect(
        prisma.installationAppointment.findUniqueOrThrow({
          where: { id: fixture.appointments.assigned.id },
        }),
      ).resolves.toMatchObject({
        status: AppointmentStatus.EN_ROUTE,
        version: 2,
      });
      await expect(
        prisma.auditLog.count({
          where: {
            action: 'operations.technician-en-route',
            targetId: fixture.appointments.assigned.id,
          },
        }),
      ).resolves.toBe(1);
    });
  });

  it('paginates an assigned technician jobs and derives action options from policy', async () => {
    await withFixture(async (fixture) => {
      const second = await fixture.createAppointment({
        assignedTechnician: fixture.users.technicianA,
        status: AppointmentStatus.ASSIGNED,
      });
      const firstPage = await listTechnicianAssignments(
        fixture.users.technicianA.actor,
        { limit: 1, status: AppointmentStatus.ASSIGNED },
      );
      const secondPage = await listTechnicianAssignments(
        fixture.users.technicianA.actor,
        {
          limit: 1,
          status: AppointmentStatus.ASSIGNED,
          cursor: firstPage.nextCursor!,
        },
      );
      expect(firstPage.nextCursor).toBeTruthy();
      expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
      expect([fixture.appointments.assigned.id, second.id]).toContain(
        firstPage.items[0].appointment.id,
      );
      await expect(
        getTechnicianActionOptions(
          fixture.users.technicianA.actor,
          fixture.appointments.assigned.assignmentId,
        ),
      ).resolves.toMatchObject({
        actions: expect.arrayContaining([
          expect.objectContaining({ action: 'accept' }),
          expect.objectContaining({ action: 'en-route' }),
        ]),
      });
    });
  });

  it('paginates warranty and audit lists with distinct cursors', async () => {
    await withFixture(async (fixture) => {
      const secondAppointment = await fixture.createAppointment();
      const secondWarranty = await fixture.createWarranty(
        secondAppointment.orderItemId,
      );
      const warrantiesFirst = await listWarranties(
        fixture.users.manager.actor,
        {
          limit: 1,
        },
      );
      const warrantiesSecond = await listWarranties(
        fixture.users.manager.actor,
        { limit: 1, cursor: warrantiesFirst.nextCursor! },
      );
      expect(warrantiesFirst.nextCursor).toBeTruthy();
      expect(warrantiesSecond.items[0].id).not.toBe(
        warrantiesFirst.items[0].id,
      );
      expect([fixture.warrantyRequestId, secondWarranty]).toContain(
        warrantiesFirst.items[0].id,
      );

      await prisma.auditLog.createMany({
        data: ['one', 'two'].map((suffix) => ({
          actorUserId: fixture.users.manager.id,
          action: `operations.fixture-pagination-${suffix}`,
          targetType: 'fixture',
          targetId: `${fixture.namespace}-${suffix}`,
          before: {},
          after: {},
          requestId: `${fixture.namespace}-audit-${suffix}`,
        })),
      });
      const auditFirst = await listAudit(fixture.users.manager.actor, {
        limit: 1,
      });
      const auditSecond = await listAudit(fixture.users.manager.actor, {
        limit: 1,
        cursor: auditFirst.nextCursor!,
      });
      expect(auditFirst.nextCursor).toBeTruthy();
      expect(auditSecond.items[0].id).not.toBe(auditFirst.items[0].id);
    });
  });

  it('authorizes evidence preview for operations and rejects unrelated customers', async () => {
    await withFixture(async (fixture) => {
      const evidence = await addEvidence(
        fixture.users.technicianA.actor,
        fixture.appointments.assigned.assignmentId,
        {
          filename: 'fixture.png',
          contentType: 'image/png',
          contentBase64: validPng,
        },
        `${fixture.namespace}-evidence`,
      );
      await expect(
        getEvidencePreview(fixture.users.customerB.actor, evidence.id),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        getEvidencePreview(fixture.users.manager.actor, evidence.id),
      ).resolves.toMatchObject({ mimeType: 'image/png' });
    });
  });

  it('cleans staged evidence for database and filesystem failures', async () => {
    await withFixture(async (fixture) => {
      const before = await evidenceFiles();
      await expect(
        storeLocalEvidence(
          {
            filename: 'database-failure.png',
            contentType: 'image/png',
            contentBase64: validPng,
          },
          async () =>
            prisma.$transaction(async (tx) => {
              await tx.auditLog.create({
                data: {
                  actorUserId: fixture.users.manager.id,
                  action: 'operations.fixture-evidence-db-failure',
                  targetType: 'fixture',
                  targetId: fixture.namespace,
                  before: {},
                  after: {},
                  requestId: `${fixture.namespace}-db-failure`,
                },
              });
              throw new Error('fixture database failure');
            }),
          async () => undefined,
        ),
      ).rejects.toThrow('fixture database failure');

      let compensatedAuditId: string | undefined;
      await expect(
        storeLocalEvidence(
          {
            filename: 'filesystem-failure.png',
            contentType: 'image/png',
            contentBase64: validPng,
          },
          async (staged) => {
            await discardLocalEvidence(staged);
            const audit = await prisma.auditLog.create({
              data: {
                actorUserId: fixture.users.manager.id,
                action: 'operations.fixture-evidence-filesystem-failure',
                targetType: 'fixture',
                targetId: fixture.namespace,
                before: {},
                after: {},
                requestId: `${fixture.namespace}-filesystem-failure`,
              },
            });
            return audit;
          },
          async (audit) => {
            compensatedAuditId = audit.id;
            await prisma.auditLog.delete({ where: { id: audit.id } });
          },
        ),
      ).rejects.toThrow();
      expect(compensatedAuditId).toBeTruthy();
      await expect(
        prisma.auditLog.findUnique({ where: { id: compensatedAuditId } }),
      ).resolves.toBeNull();
      await expect(evidenceFiles()).resolves.toEqual(before);
    });
  });

  it('cleans database rows and evidence after a browser close cleanup failure', async () => {
    const fixture = await createOperationsFixture();
    let cleanupCompleted = false;
    try {
      const evidence = await addEvidence(
        fixture.users.technicianA.actor,
        fixture.appointments.assigned.assignmentId,
        {
          filename: 'cleanup-proof.png',
          contentType: 'image/png',
          contentBase64: validPng,
        },
        `${fixture.namespace}-cleanup-proof`,
      );
      const stored = await prisma.installationEvidence.findUniqueOrThrow({
        where: { id: evidence.id },
        select: { storageKey: true },
      });
      await expect(readLocalEvidence(stored.storageKey)).resolves.toBeTruthy();

      const cleanupError = await runFailureSafeCleanup([
        {
          name: 'simulated browser close failure',
          run: async () => {
            throw new Error('browser close failed');
          },
        },
        { name: 'fixture cleanup', run: fixture.cleanup },
      ]).catch((error: unknown) => error);
      expect(cleanupError).toBeInstanceOf(AggregateError);
      expect((cleanupError as AggregateError).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('browser close failed'),
          }),
        ]),
      );
      cleanupCompleted = true;

      await expect(
        prisma.user.count({
          where: { email: { startsWith: `${fixture.namespace}.` } },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.order.count({
          where: {
            orderNumber: { startsWith: `${fixture.namespace.toUpperCase()}-` },
          },
        }),
      ).resolves.toBe(0);
      await expect(readLocalEvidence(stored.storageKey)).resolves.toBeNull();
    } finally {
      if (!cleanupCompleted) await fixture.cleanup();
    }
  });
});
