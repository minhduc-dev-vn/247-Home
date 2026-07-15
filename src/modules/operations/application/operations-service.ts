import {
  AppointmentStatus,
  AssignmentStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  WarrantyStatus,
} from '@prisma/client';

import { CatalogError } from '@/modules/catalog';
import { lockOrder } from '@/modules/commerce/infrastructure/order-repository';
import { actorHasRole, type IdentityActor } from '@/modules/identity';
import { authorizeInstallationTransition } from '@/modules/operations/domain/installation-transition';
import {
  readLocalEvidence,
  storeLocalEvidence,
  type EvidenceInput,
} from '@/modules/operations/infrastructure/local-evidence-storage';
import {
  lockAppointmentForAssignment,
  lockInstallationAppointment,
  lockOperationsSlot,
  type LockedOperationsSlot,
} from '@/modules/operations/infrastructure/operations-repository';
import { prisma } from '@/shared/db/client';

const managementRoles = ['MANAGER', 'ADMIN'] as const;
const operationsRoles = ['STAFF', 'MANAGER', 'ADMIN'] as const;
type PageInput = { cursor?: string; limit: number };
type OrderListInput = PageInput & { status?: OrderStatus };
type AppointmentListInput = PageInput & { status?: AppointmentStatus };
type AvailableTechnicianInput = PageInput & {
  appointmentId: string;
  search?: string;
};
type TechnicianAssignmentListInput = PageInput & {
  status?: AppointmentStatus;
};
type WarrantyListInput = PageInput & { status?: WarrantyStatus };
type AuditListInput = PageInput & {
  action?: string;
  targetId?: string;
  targetType?: string;
};

function page<T extends { id: string }>(rows: T[], limit: number) {
  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
}

function requireOperations(actor: IdentityActor | null) {
  if (!actor || !actorHasRole(actor, operationsRoles))
    throw new CatalogError('FORBIDDEN');
  return actor;
}
function requireManagement(actor: IdentityActor | null) {
  if (!actor || !actorHasRole(actor, managementRoles))
    throw new CatalogError('FORBIDDEN');
  return actor;
}
function requireTechnician(actor: IdentityActor | null) {
  if (!actor || !actorHasRole(actor, ['TECHNICIAN']))
    throw new CatalogError('FORBIDDEN');
  return actor;
}

const appointmentSelect = {
  id: true,
  slotId: true,
  status: true,
  version: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  serviceArea: {
    select: { id: true, code: true, provinceName: true, districtName: true },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      recipientName: true,
      addressLine1: true,
      wardName: true,
      districtName: true,
      provinceName: true,
    },
  },
  assignments: {
    where: { status: AssignmentStatus.ACTIVE },
    select: {
      id: true,
      technicianId: true,
      status: true,
      technician: { select: { user: { select: { name: true } } } },
      acceptedAt: true,
      enRouteAt: true,
      arrivedAt: true,
      startedAt: true,
      completedAt: true,
    },
  },
} satisfies Prisma.InstallationAppointmentSelect;

const technicianListAppointmentSelect = {
  id: true,
  status: true,
  version: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  serviceArea: {
    select: { code: true, provinceName: true, districtName: true },
  },
  order: { select: { orderNumber: true } },
} satisfies Prisma.InstallationAppointmentSelect;

const technicianDetailAppointmentSelect = {
  id: true,
  status: true,
  version: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  customerNote: true,
  serviceArea: {
    select: { code: true, provinceName: true, districtName: true },
  },
  order: {
    select: {
      orderNumber: true,
      recipientName: true,
      addressLine1: true,
      wardName: true,
      districtName: true,
      provinceName: true,
      items: {
        select: {
          id: true,
          productName: true,
          variantName: true,
          servicePackageName: true,
          quantity: true,
        },
      },
    },
  },
} satisfies Prisma.InstallationAppointmentSelect;

export async function listOperationsOrders(
  actor: IdentityActor | null,
  input: OrderListInput,
) {
  requireOperations(actor);
  const rows = await prisma.order.findMany({
    where: input.status ? { status: input.status } : undefined,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      grandTotal: true,
      createdAt: true,
      appointment: { select: { id: true, status: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
  });
  return page(
    rows.map((row) => ({ ...row, grandTotal: row.grandTotal.toString() })),
    input.limit,
  );
}
export async function getOperationsOrder(
  actor: IdentityActor | null,
  id: string,
) {
  requireOperations(actor);
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      version: true,
      grandTotal: true,
      recipientName: true,
      addressLine1: true,
      wardName: true,
      districtName: true,
      provinceName: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          productName: true,
          variantName: true,
          quantity: true,
          lineTotal: true,
        },
      },
      payment: { select: { method: true, status: true } },
      appointment: { select: appointmentSelect },
    },
  });
  if (!order) return null;
  return {
    ...order,
    grandTotal: order.grandTotal.toString(),
    items: order.items.map((item) => ({
      ...item,
      lineTotal: item.lineTotal.toString(),
    })),
  };
}
export async function listAppointments(
  actor: IdentityActor | null,
  input: AppointmentListInput,
) {
  requireOperations(actor);
  const rows = await prisma.installationAppointment.findMany({
    where: input.status ? { status: input.status } : undefined,
    select: appointmentSelect,
    orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
  });
  return page(rows, input.limit);
}
export async function listAvailableTechnicians(
  actor: IdentityActor | null,
  input: AvailableTechnicianInput,
) {
  const limit = Math.max(1, Math.min(input.limit, 100));
  const manager = requireManagement(actor);
  const appointment = await prisma.installationAppointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      status: true,
      serviceAreaId: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  });
  if (!appointment) throw new CatalogError('NOT_FOUND');
  authorizeInstallationTransition({
    actor: manager,
    action: 'assign',
    current: appointment.status,
  });
  const rows = await prisma.technician.findMany({
    where: {
      isActive: true,
      user: {
        isActive: true,
        ...(input.search
          ? { name: { contains: input.search, mode: 'insensitive' } }
          : {}),
      },
      serviceAreas: { some: { serviceAreaId: appointment.serviceAreaId } },
      assignments: {
        none: {
          status: AssignmentStatus.ACTIVE,
          scheduledStartAt: { lt: appointment.scheduledEndAt },
          scheduledEndAt: { gt: appointment.scheduledStartAt },
          appointment: {
            status: {
              notIn: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
            },
          },
        },
      },
    },
    select: { id: true, user: { select: { name: true } } },
    orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: limit + 1,
  });
  return page(rows, limit);
}
export async function assignTechnician(
  actor: IdentityActor | null,
  appointmentId: string,
  technicianId: string,
  expectedVersion: number,
  reason: string,
  requestId: string,
) {
  const manager = requireManagement(actor);
  try {
    return await prisma.$transaction(async (tx) => {
      if (!(await lockInstallationAppointment(tx, appointmentId)))
        throw new CatalogError('NOT_FOUND');
      const appointment = await tx.installationAppointment.findUnique({
        where: { id: appointmentId },
        select: {
          id: true,
          status: true,
          version: true,
          serviceAreaId: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
        },
      });
      if (!appointment) throw new CatalogError('NOT_FOUND');
      if (appointment.version !== expectedVersion)
        throw new CatalogError('CONFLICT');
      const decision = authorizeInstallationTransition({
        actor: manager,
        action: 'assign',
        current: appointment.status,
      });
      const technician = await tx.technician.findFirst({
        where: {
          id: technicianId,
          isActive: true,
          user: { isActive: true },
          serviceAreas: { some: { serviceAreaId: appointment.serviceAreaId } },
        },
        select: { id: true },
      });
      if (!technician) throw new CatalogError('NOT_FOUND');
      const conflict = await tx.technicianAssignment.findFirst({
        where: {
          technicianId,
          status: AssignmentStatus.ACTIVE,
          appointment: {
            scheduledStartAt: { lt: appointment.scheduledEndAt },
            scheduledEndAt: { gt: appointment.scheduledStartAt },
          },
        },
        select: { id: true },
      });
      if (conflict) throw new CatalogError('CONFLICT');
      const assignment = await tx.technicianAssignment.create({
        data: {
          appointmentId,
          technicianId,
          scheduledStartAt: appointment.scheduledStartAt,
          scheduledEndAt: appointment.scheduledEndAt,
        },
      });
      const updated = await tx.installationAppointment.updateMany({
        where: {
          id: appointmentId,
          version: expectedVersion,
          status: appointment.status,
        },
        data: { status: decision.next, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new CatalogError('CONFLICT');
      await tx.auditLog.create({
        data: {
          actorUserId: manager.userId,
          action: 'operations.technician-assigned',
          targetType: 'installation_appointment',
          targetId: appointmentId,
          before: { status: appointment.status },
          after: { status: decision.next, technicianId },
          reason,
          requestId,
        },
      });
      return assignment;
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2004')
    )
      throw new CatalogError('CONFLICT', 'TECHNICIAN_SCHEDULE_CONFLICT');
    if (
      error instanceof Prisma.PrismaClientUnknownRequestError &&
      /23P01|40P01|technician_assignments_no_active_overlap/.test(error.message)
    )
      throw new CatalogError('CONFLICT', 'TECHNICIAN_SCHEDULE_CONFLICT');
    throw error;
  }
}
export async function rescheduleAppointment(
  actor: IdentityActor | null,
  appointmentId: string,
  slotId: string,
  expectedVersion: number,
  reason: string,
  requestId: string,
) {
  const manager = requireManagement(actor);
  return prisma.$transaction(async (tx) => {
    if (!(await lockInstallationAppointment(tx, appointmentId)))
      throw new CatalogError('NOT_FOUND');
    const appointment = await tx.installationAppointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        slotId: true,
        serviceAreaId: true,
        status: true,
        version: true,
        capacityReleasedAt: true,
      },
    });
    if (!appointment) throw new CatalogError('NOT_FOUND');
    if (appointment.version !== expectedVersion)
      throw new CatalogError('CONFLICT');
    authorizeInstallationTransition({
      actor: manager,
      action: 'reschedule',
      current: appointment.status,
    });
    if (slotId === appointment.slotId)
      throw new CatalogError('INVALID_STATE_TRANSITION');
    const ids = [appointment.slotId, slotId].sort();
    const slots: LockedOperationsSlot[] = [];
    for (const id of ids) {
      const slot = await lockOperationsSlot(tx, id);
      if (slot) slots.push(slot);
    }
    const oldSlot = slots.find((slot) => slot?.id === appointment.slotId);
    const newSlot = slots.find((slot) => slot?.id === slotId);
    if (!oldSlot || !newSlot) throw new CatalogError('SLOT_UNAVAILABLE');
    if (newSlot.serviceAreaId !== appointment.serviceAreaId)
      throw new CatalogError('SLOT_UNAVAILABLE');
    if (newSlot.startsAt <= new Date())
      throw new CatalogError('SLOT_UNAVAILABLE');
    const reservedTarget = await tx.installationSlot.updateMany({
      where: {
        id: newSlot.id,
        isActive: true,
        bookedCount: { lt: newSlot.capacity },
      },
      data: { bookedCount: { increment: 1 }, version: { increment: 1 } },
    });
    if (reservedTarget.count !== 1) throw new CatalogError('SLOT_UNAVAILABLE');
    if (!appointment.capacityReleasedAt) {
      const releasedSource = await tx.installationSlot.updateMany({
        where: { id: oldSlot.id, bookedCount: { gt: 0 } },
        data: { bookedCount: { decrement: 1 }, version: { increment: 1 } },
      });
      if (releasedSource.count !== 1)
        throw new CatalogError('SLOT_UNAVAILABLE');
    }
    await tx.technicianAssignment.updateMany({
      where: { appointmentId, status: AssignmentStatus.ACTIVE },
      data: { status: AssignmentStatus.CANCELLED },
    });
    const updated = await tx.installationAppointment.updateMany({
      where: {
        id: appointmentId,
        version: expectedVersion,
        status: appointment.status,
      },
      data: {
        slotId: newSlot.id,
        scheduledStartAt: newSlot.startsAt,
        scheduledEndAt: newSlot.endsAt,
        status: AppointmentStatus.ASSIGNMENT_PENDING,
        version: { increment: 1 },
        capacityReleasedAt: null,
      },
    });
    if (updated.count !== 1) throw new CatalogError('CONFLICT');
    await tx.auditLog.create({
      data: {
        actorUserId: manager.userId,
        action: 'operations.appointment-rescheduled',
        targetType: 'installation_appointment',
        targetId: appointmentId,
        before: { slotId: appointment.slotId, status: appointment.status },
        after: {
          slotId: newSlot.id,
          status: AppointmentStatus.ASSIGNMENT_PENDING,
        },
        reason,
        requestId,
      },
    });
    return tx.installationAppointment.findUniqueOrThrow({
      where: { id: appointmentId },
    });
  });
}
export async function listTechnicianAssignments(
  actor: IdentityActor | null,
  input: TechnicianAssignmentListInput = { limit: 25 },
) {
  const technicianActor = requireTechnician(actor);
  const rows = await prisma.technicianAssignment.findMany({
    where: {
      technician: { userId: technicianActor.userId },
      status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.COMPLETED] },
      ...(input.status ? { appointment: { status: input.status } } : {}),
    },
    select: {
      id: true,
      status: true,
      appointment: { select: technicianListAppointmentSelect },
    },
    orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
  });
  return page(rows, input.limit);
}
export async function getTechnicianAssignment(
  actor: IdentityActor | null,
  assignmentId: string,
) {
  const technicianActor = requireTechnician(actor);
  const assignment = await prisma.technicianAssignment.findFirst({
    where: {
      id: assignmentId,
      status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.COMPLETED] },
      technician: { userId: technicianActor.userId },
    },
    select: {
      id: true,
      status: true,
      completionNote: true,
      assignedAt: true,
      acceptedAt: true,
      enRouteAt: true,
      arrivedAt: true,
      startedAt: true,
      completedAt: true,
      appointment: { select: technicianDetailAppointmentSelect },
      evidence: {
        select: { id: true, mimeType: true, byteSize: true, createdAt: true },
      },
    },
  });
  if (!assignment) throw new CatalogError('NOT_FOUND');
  return assignment;
}
const technicianActionLabels = {
  accept: 'Nhan viec',
  'en-route': 'Bat dau di chuyen',
  arrive: 'Da den',
  start: 'Bat dau cong viec',
  complete: 'Hoan thanh',
} as const;

export async function getTechnicianActionOptions(
  actor: IdentityActor | null,
  assignmentId: string,
) {
  const technicianActor = requireTechnician(actor);
  const assignment = await prisma.technicianAssignment.findFirst({
    where: {
      id: assignmentId,
      status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.COMPLETED] },
      technician: { userId: technicianActor.userId },
    },
    select: {
      status: true,
      acceptedAt: true,
      appointment: { select: { status: true } },
    },
  });
  if (!assignment) throw new CatalogError('NOT_FOUND');
  if (assignment.status !== AssignmentStatus.ACTIVE) return { actions: [] };

  const actions = Object.entries(technicianActionLabels).flatMap(
    ([action, label]) => {
      if (action === 'accept' && assignment.acceptedAt) return [];
      try {
        authorizeInstallationTransition({
          actor: technicianActor,
          action: action as keyof typeof technicianActionLabels,
          current: assignment.appointment.status,
          ownsActiveAssignment: true,
          alreadyAccepted: Boolean(assignment.acceptedAt),
        });
        return [{ action, label, requiresNote: action === 'complete' }];
      } catch {
        return [];
      }
    },
  );
  return { actions };
}
export async function addEvidence(
  actor: IdentityActor | null,
  assignmentId: string,
  input: {
    filename: string;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
    contentBase64: string;
  },
  requestId: string,
) {
  const technicianActor = requireTechnician(actor);
  const assignment = await prisma.technicianAssignment.findFirst({
    where: {
      id: assignmentId,
      technician: { userId: technicianActor.userId },
      status: AssignmentStatus.ACTIVE,
    },
    select: { id: true },
  });
  if (!assignment) throw new CatalogError('NOT_FOUND');
  return storeLocalEvidence(
    input as EvidenceInput,
    async (staged) =>
      prisma.$transaction(async (tx) => {
        const created = await tx.installationEvidence.create({
          data: {
            assignmentId,
            storageKey: staged.storageKey,
            mimeType: staged.contentType,
            byteSize: staged.byteSize,
          },
          select: { id: true, mimeType: true, byteSize: true, createdAt: true },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: technicianActor.userId,
            action: 'operations.installation-evidence-added',
            targetType: 'technician_assignment',
            targetId: assignmentId,
            before: {},
            after: {
              evidenceId: created.id,
              mimeType: staged.contentType,
              byteSize: staged.byteSize,
            },
            requestId,
          },
        });
        return created;
      }),
    (evidence) =>
      prisma.$transaction(async (tx) => {
        await tx.installationEvidence.delete({ where: { id: evidence.id } });
        await tx.auditLog.create({
          data: {
            actorUserId: technicianActor.userId,
            action: 'operations.installation-evidence-compensated',
            targetType: 'technician_assignment',
            targetId: assignmentId,
            before: { evidenceId: evidence.id },
            after: {},
            reason: 'Local file finalization failed',
            requestId,
          },
        });
      }),
  );
}

export async function getEvidencePreview(
  actor: IdentityActor | null,
  evidenceId: string,
) {
  if (!actor) throw new CatalogError('UNAUTHENTICATED');
  const evidence = await prisma.installationEvidence.findUnique({
    where: { id: evidenceId },
    select: {
      storageKey: true,
      mimeType: true,
      assignment: { select: { technician: { select: { userId: true } } } },
    },
  });
  const canRead =
    evidence &&
    (actorHasRole(actor, operationsRoles) ||
      (actorHasRole(actor, ['TECHNICIAN']) &&
        evidence.assignment.technician.userId === actor.userId));
  if (!canRead || !evidence) throw new CatalogError('NOT_FOUND');
  const content = await readLocalEvidence(evidence.storageKey);
  if (!content) throw new CatalogError('NOT_FOUND');
  return { content, mimeType: evidence.mimeType };
}
export async function technicianAction(
  actor: IdentityActor | null,
  assignmentId: string,
  action: 'accept' | 'en-route' | 'arrive' | 'start' | 'complete',
  expectedVersion: number,
  note: string | undefined,
  requestId: string,
) {
  const technicianActor = requireTechnician(actor);
  return prisma.$transaction(async (tx) => {
    if (!(await lockAppointmentForAssignment(tx, assignmentId)))
      throw new CatalogError('NOT_FOUND');
    const assignment = await tx.technicianAssignment.findFirst({
      where: {
        id: assignmentId,
        technician: { userId: technicianActor.userId },
        status: AssignmentStatus.ACTIVE,
      },
      select: {
        id: true,
        appointmentId: true,
        acceptedAt: true,
        appointment: {
          select: { id: true, orderId: true, status: true, version: true },
        },
      },
    });
    if (!assignment) throw new CatalogError('NOT_FOUND');
    if (assignment.appointment.version !== expectedVersion)
      throw new CatalogError('CONFLICT');
    const decision = authorizeInstallationTransition({
      actor: technicianActor,
      action,
      current: assignment.appointment.status,
      ownsActiveAssignment: true,
      alreadyAccepted: Boolean(assignment.acceptedAt),
    });
    if (decision.idempotent) return assignment.appointment;
    if (action === 'complete' && !note)
      throw new CatalogError('INVALID_STATE_TRANSITION');
    if (!(await lockOrder(tx, assignment.appointment.orderId)))
      throw new CatalogError('NOT_FOUND');
    const order = await tx.order.findUnique({
      where: { id: assignment.appointment.orderId },
      select: { id: true, status: true, payment: { select: { status: true } } },
    });
    if (!order) throw new CatalogError('NOT_FOUND');
    const now = new Date();
    if (action === 'start')
      if (
        (
          await tx.order.updateMany({
            where: {
              id: order.id,
              status: OrderStatus.READY_FOR_INSTALLATION,
            },
            data: {
              status: OrderStatus.INSTALLATION_IN_PROGRESS,
              version: { increment: 1 },
            },
          })
        ).count !== 1
      )
        throw new CatalogError('INVALID_STATE_TRANSITION');
    if (action === 'complete')
      if (order.payment?.status !== PaymentStatus.PAID)
        throw new CatalogError('INVALID_STATE_TRANSITION', 'PAYMENT_NOT_READY');
    if (action === 'complete')
      if (
        (
          await tx.order.updateMany({
            where: {
              id: order.id,
              status: OrderStatus.INSTALLATION_IN_PROGRESS,
            },
            data: {
              status: OrderStatus.COMPLETED,
              completedAt: new Date(),
              version: { increment: 1 },
            },
          })
        ).count !== 1
      )
        throw new CatalogError('INVALID_STATE_TRANSITION');
    const appointmentUpdate = await tx.installationAppointment.updateMany({
      where: {
        id: assignment.appointmentId,
        version: expectedVersion,
        status: assignment.appointment.status,
      },
      data: { status: decision.next, version: { increment: 1 } },
    });
    if (appointmentUpdate.count !== 1) throw new CatalogError('CONFLICT');
    const timestampData = {
      accept: { acceptedAt: now },
      'en-route': { enRouteAt: now },
      arrive: { arrivedAt: now },
      start: { startedAt: now },
      complete: {
        completedAt: now,
        status: AssignmentStatus.COMPLETED,
        completionNote: note,
      },
    } satisfies Record<
      string,
      Prisma.TechnicianAssignmentUpdateManyMutationInput
    >;
    const assignmentUpdate = await tx.technicianAssignment.updateMany({
      where: { id: assignmentId, status: AssignmentStatus.ACTIVE },
      data: timestampData[action],
    });
    if (assignmentUpdate.count !== 1) throw new CatalogError('CONFLICT');
    await tx.auditLog.create({
      data: {
        actorUserId: technicianActor.userId,
        action: `operations.technician-${action}`,
        targetType: 'installation_appointment',
        targetId: assignment.appointmentId,
        before: { status: assignment.appointment.status },
        after: { status: decision.next },
        reason: note ?? null,
        requestId,
      },
    });
    return tx.installationAppointment.findUniqueOrThrow({
      where: { id: assignment.appointmentId },
    });
  });
}
export async function listWarranties(
  actor: IdentityActor | null,
  input: WarrantyListInput,
) {
  requireOperations(actor);
  const rows = await prisma.warrantyRequest.findMany({
    where: input.status ? { status: input.status } : undefined,
    select: {
      id: true,
      requestNumber: true,
      status: true,
      issueType: true,
      createdAt: true,
      orderItem: {
        select: {
          order: { select: { id: true, orderNumber: true, status: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
  });
  return page(rows, input.limit);
}
export async function getOperationsWarranty(
  actor: IdentityActor | null,
  id: string,
) {
  requireOperations(actor);
  return prisma.warrantyRequest.findUnique({
    where: { id },
    select: {
      id: true,
      requestNumber: true,
      status: true,
      issueType: true,
      description: true,
      submittedAt: true,
      customer: { select: { name: true } },
      orderItem: {
        select: {
          productName: true,
          variantName: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              appointment: {
                select: {
                  id: true,
                  status: true,
                  scheduledStartAt: true,
                  scheduledEndAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
}
export async function listAudit(
  actor: IdentityActor | null,
  input: AuditListInput,
) {
  requireManagement(actor);
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(input.action ? { action: input.action } : {}),
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
    },
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      reason: true,
      createdAt: true,
      actor: { select: { email: true, name: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
  });
  return page(rows, input.limit);
}
