import { createHash, randomUUID } from 'node:crypto';

import { Prisma, WarrantyCoverageType, WarrantyStatus } from '@prisma/client';

import { CatalogError } from '@/modules/catalog';
import { actorHasRole, type IdentityActor } from '@/modules/identity';
import {
  getEvidenceStorage,
  StorageProviderError,
  uploadAndPersist,
  type StorageUploadInput,
} from '@/modules/storage';
import {
  decideWarrantyTransition,
  evaluateWarrantyEligibility,
  hasDuplicateWarrantyCoverage,
} from '@/modules/warranty/domain/warranty-policy';
import { lockWarrantyCreateIdempotency } from '@/modules/warranty/infrastructure/warranty-repository';
import {
  type WarrantyAuditListInput,
  type WarrantyCreateInput,
  type WarrantyEvidenceInput,
  type WarrantyListInput,
  type WarrantyStateInput,
} from '@/modules/warranty/presentation/schemas';
import { prisma } from '@/shared/db/client';

const customerRoles = ['CUSTOMER'] as const;
const operationsReadRoles = ['STAFF', 'MANAGER', 'ADMIN'] as const;

function requireCustomerRead(actor: IdentityActor | null): IdentityActor {
  if (!actor) throw new CatalogError('UNAUTHENTICATED');
  if (!actorHasRole(actor, customerRoles)) throw new CatalogError('FORBIDDEN');
  return actor;
}

function requireCustomerMutation(actor: IdentityActor | null): IdentityActor {
  const customer = requireCustomerRead(actor);
  if (actorHasRole(customer, ['STAFF', 'TECHNICIAN', 'MANAGER', 'ADMIN'])) {
    throw new CatalogError('FORBIDDEN');
  }
  return customer;
}

function requireTransitionActor(actor: IdentityActor | null): IdentityActor {
  if (!actor) throw new CatalogError('UNAUTHENTICATED');
  if (actorHasRole(actor, ['ADMIN', 'TECHNICIAN'])) {
    throw new CatalogError('FORBIDDEN');
  }
  if (!actorHasRole(actor, ['CUSTOMER', 'STAFF', 'MANAGER'])) {
    throw new CatalogError('FORBIDDEN');
  }
  return actor;
}

function requestNumber(): string {
  return `WAR-${new Date().getUTCFullYear()}-${randomUUID()
    .replaceAll('-', '')
    .slice(0, 12)
    .toUpperCase()}`;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const warrantyOrderItemSelect = {
  id: true,
  servicePackageId: true,
  warrantyMonths: true,
  productVariantId: true,
  productVariant: { select: { productId: true } },
  order: {
    select: {
      id: true,
      status: true,
      completedAt: true,
      recipientPhone: true,
    },
  },
} satisfies Prisma.OrderItemSelect;

type WarrantyOrderItem = Prisma.OrderItemGetPayload<{
  select: typeof warrantyOrderItemSelect;
}>;

async function resolveWarrantyOrderItem(
  tx: Prisma.TransactionClient,
  customerUserId: string,
  input: WarrantyCreateInput,
): Promise<WarrantyOrderItem> {
  if ('orderItemId' in input) {
    const orderItem = await tx.orderItem.findFirst({
      where: {
        id: input.orderItemId,
        order: { userId: customerUserId },
      },
      select: warrantyOrderItemSelect,
    });
    if (!orderItem) throw new CatalogError('NOT_FOUND');
    return orderItem;
  }

  const candidates = await tx.orderItem.findMany({
    where: {
      orderId: input.orderId,
      order: { userId: customerUserId },
      productVariant: { productId: input.productId },
      ...(input.coverageType === 'INSTALLATION'
        ? { servicePackageId: { not: null } }
        : {}),
    },
    orderBy: { id: 'asc' },
    take: 3,
    select: warrantyOrderItemSelect,
  });
  if (!candidates.length) throw new CatalogError('NOT_FOUND');
  const onlyCandidate = candidates.at(0);
  if (candidates.length === 1 && onlyCandidate) return onlyCandidate;

  const withoutPackage = candidates.filter(
    (candidate) => candidate.servicePackageId === null,
  );
  if (input.coverageType === 'DEVICE' && withoutPackage.length === 1) {
    const deviceOnlyCandidate = withoutPackage.at(0);
    if (deviceOnlyCandidate) return deviceOnlyCandidate;
  }
  throw new CatalogError('CONFLICT', 'AMBIGUOUS_ORDER_PRODUCT');
}

const warrantySummarySelect = {
  id: true,
  requestNumber: true,
  coverageType: true,
  status: true,
  issueType: true,
  warrantyStartsAt: true,
  warrantyExpiresAt: true,
  submittedAt: true,
  updatedAt: true,
  version: true,
  orderItem: {
    select: {
      id: true,
      productName: true,
      variantName: true,
      sku: true,
      servicePackageName: true,
      quantity: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          completedAt: true,
        },
      },
    },
  },
} satisfies Prisma.WarrantyRequestSelect;

const warrantyDetailSelect = {
  ...warrantySummarySelect,
  description: true,
  contactPhone: true,
  publicResolution: true,
  resolvedAt: true,
  closedAt: true,
  rejectedAt: true,
  evidence: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: 25,
    select: {
      id: true,
      mimeType: true,
      byteSize: true,
      createdAt: true,
    },
  },
} satisfies Prisma.WarrantyRequestSelect;

export async function listWarrantyRequests(
  actor: IdentityActor | null,
  input: WarrantyListInput,
) {
  const customer = requireCustomerRead(actor);
  const rows = await prisma.warrantyRequest.findMany({
    where: {
      customerUserId: customer.userId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
    select: warrantySummarySelect,
  });
  const hasNext = rows.length > input.limit;
  const items = rows.slice(0, input.limit);
  return {
    items,
    nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null,
  };
}

export async function listEligibleWarrantyItems(
  actor: IdentityActor | null,
  limit = 24,
  now = new Date(),
) {
  const customer = requireCustomerMutation(actor);
  const cappedLimit = Math.min(Math.max(limit, 1), 100);
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        userId: customer.userId,
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      warrantyMonths: { gt: 0 },
    },
    orderBy: [{ order: { completedAt: 'desc' } }, { id: 'asc' }],
    take: 100,
    select: {
      id: true,
      productName: true,
      variantName: true,
      servicePackageId: true,
      servicePackageName: true,
      warrantyMonths: true,
      productVariant: { select: { productId: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          completedAt: true,
        },
      },
      warrantyRequests: { select: { coverageType: true } },
    },
  });

  const eligible = orderItems.flatMap((item) => {
    const coverageTypes = [
      WarrantyCoverageType.DEVICE,
      ...(item.servicePackageId ? [WarrantyCoverageType.INSTALLATION] : []),
    ];
    return coverageTypes.flatMap((coverageType) => {
      if (
        hasDuplicateWarrantyCoverage(
          item.warrantyRequests.map((request) => request.coverageType),
          coverageType,
        )
      ) {
        return [];
      }
      const decision = evaluateWarrantyEligibility({
        orderStatus: item.order.status,
        completedAt: item.order.completedAt,
        warrantyMonths: item.warrantyMonths,
        hasServicePackage: item.servicePackageId !== null,
        coverageType,
        now,
      });
      if (!decision.eligible) return [];
      return [
        {
          orderItemId: item.id,
          orderId: item.order.id,
          orderNumber: item.order.orderNumber,
          productId: item.productVariant.productId,
          productName: item.productName,
          variantName: item.variantName,
          servicePackageName: item.servicePackageName,
          coverageType,
          warrantyStartsAt: decision.startsAt,
          warrantyExpiresAt: decision.expiresAt,
        },
      ];
    });
  });

  return eligible.slice(0, cappedLimit);
}

export async function getWarrantyRequest(
  actor: IdentityActor | null,
  warrantyRequestId: string,
) {
  const customer = requireCustomerRead(actor);
  const request = await prisma.warrantyRequest.findFirst({
    where: { id: warrantyRequestId, customerUserId: customer.userId },
    select: warrantyDetailSelect,
  });
  if (!request) throw new CatalogError('NOT_FOUND');
  return request;
}

export async function createWarrantyRequest(
  actor: IdentityActor | null,
  input: WarrantyCreateInput,
  requestId: string,
  idempotencyKey = requestId,
  now = new Date(),
) {
  const customer = requireCustomerMutation(actor);
  const idempotencyHash = hash(idempotencyKey);
  let requestFingerprint: string | undefined;
  try {
    return await prisma.$transaction(async (tx) => {
      await lockWarrantyCreateIdempotency(
        tx,
        customer.userId,
        idempotencyHash,
      );
      const orderItem = await resolveWarrantyOrderItem(
        tx,
        customer.userId,
        input,
      );
      const contactPhone = input.contactPhone ?? orderItem.order.recipientPhone;
      const fingerprint = hash(
        JSON.stringify({
          orderItemId: orderItem.id,
          coverageType: input.coverageType,
          issueType: input.issueType,
          description: input.description,
          contactPhone,
        }),
      );
      requestFingerprint = fingerprint;

      const idempotent = await tx.warrantyRequest.findFirst({
        where: { customerUserId: customer.userId, idempotencyHash },
        select: { ...warrantyDetailSelect, requestFingerprint: true },
      });
      if (idempotent) {
        const { requestFingerprint: storedFingerprint, ...request } =
          idempotent;
        if (storedFingerprint !== fingerprint) {
          throw new CatalogError('IDEMPOTENCY_CONFLICT');
        }
        return { ...request, replayed: true };
      }

      const eligibility = evaluateWarrantyEligibility({
        orderStatus: orderItem.order.status,
        completedAt: orderItem.order.completedAt,
        warrantyMonths: orderItem.warrantyMonths,
        hasServicePackage: orderItem.servicePackageId !== null,
        coverageType: input.coverageType,
        now,
      });
      if (!eligibility.eligible) {
        throw new CatalogError('WARRANTY_NOT_ELIGIBLE', eligibility.reason);
      }

      const existing = await tx.warrantyRequest.findMany({
        where: {
          customerUserId: customer.userId,
          orderItemId: orderItem.id,
        },
        select: { coverageType: true },
      });
      if (
        hasDuplicateWarrantyCoverage(
          existing.map((request) => request.coverageType),
          input.coverageType,
        )
      ) {
        throw new CatalogError('CONFLICT', 'DUPLICATE_WARRANTY_REQUEST');
      }

      const created = await tx.warrantyRequest.create({
        data: {
          requestNumber: requestNumber(),
          orderItemId: orderItem.id,
          customerUserId: customer.userId,
          coverageType: input.coverageType,
          issueType: input.issueType,
          description: input.description,
          contactPhone,
          warrantyStartsAt: eligibility.startsAt,
          warrantyExpiresAt: eligibility.expiresAt,
          idempotencyHash,
          requestFingerprint: fingerprint,
        },
        select: warrantyDetailSelect,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: customer.userId,
          action: 'warranty.request-created',
          targetType: 'warranty_request',
          targetId: created.id,
          before: {},
          after: {
            status: created.status,
            coverageType: created.coverageType,
            version: created.version,
            orderItemId: orderItem.id,
            warrantyStartsAt: created.warrantyStartsAt.toISOString(),
            warrantyExpiresAt: created.warrantyExpiresAt.toISOString(),
          },
          requestId,
        },
      });
      return { ...created, replayed: false };
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const idempotent = await prisma.warrantyRequest.findFirst({
        where: { customerUserId: customer.userId, idempotencyHash },
        select: { ...warrantyDetailSelect, requestFingerprint: true },
      });
      if (idempotent && requestFingerprint) {
        const { requestFingerprint: storedFingerprint, ...request } =
          idempotent;
        if (storedFingerprint !== requestFingerprint) {
          throw new CatalogError('IDEMPOTENCY_CONFLICT');
        }
        return { ...request, replayed: true };
      }
      throw new CatalogError('CONFLICT', 'DUPLICATE_WARRANTY_REQUEST');
    }
    throw error;
  }
}

export async function transitionWarrantyRequest(
  actor: IdentityActor | null,
  warrantyRequestId: string,
  input: WarrantyStateInput,
  requestId: string,
  now = new Date(),
) {
  const transitionActor = requireTransitionActor(actor);
  return prisma.$transaction(async (tx) => {
    const current = await tx.warrantyRequest.findUnique({
      where: { id: warrantyRequestId },
      select: {
        id: true,
        customerUserId: true,
        status: true,
        version: true,
        assignedStaffUserId: true,
      },
    });
    if (!current) throw new CatalogError('NOT_FOUND');

    const isCustomer = actorHasRole(transitionActor, ['CUSTOMER']);
    const isProcessor = actorHasRole(transitionActor, ['STAFF', 'MANAGER']);
    if (
      isCustomer &&
      !isProcessor &&
      current.customerUserId !== transitionActor.userId
    ) {
      throw new CatalogError('NOT_FOUND');
    }
    if (current.version !== input.expectedVersion) {
      throw new CatalogError('CONCURRENT_MODIFICATION');
    }
    if (
      !isProcessor &&
      (input.internalNote !== undefined || input.publicResolution !== undefined)
    ) {
      throw new CatalogError('FORBIDDEN');
    }

    const decision = decideWarrantyTransition({
      currentStatus: current.status,
      nextStatus: input.nextStatus,
      roles: transitionActor.roles,
      isOwner: current.customerUserId === transitionActor.userId,
    });
    if (!decision.allowed) throw new CatalogError(decision.code);
    if (
      (input.nextStatus === WarrantyStatus.RESOLVED ||
        input.nextStatus === WarrantyStatus.REJECTED) &&
      !input.publicResolution
    ) {
      throw new CatalogError(
        'INVALID_STATE_TRANSITION',
        'PUBLIC_RESOLUTION_REQUIRED',
      );
    }

    const updated = await tx.warrantyRequest.updateMany({
      where: {
        id: current.id,
        version: input.expectedVersion,
        status: current.status,
      },
      data: {
        status: input.nextStatus,
        version: { increment: 1 },
        ...(isProcessor ? { assignedStaffUserId: transitionActor.userId } : {}),
        ...(isProcessor && input.publicResolution !== undefined
          ? { publicResolution: input.publicResolution }
          : {}),
        ...(isProcessor && input.internalNote !== undefined
          ? { internalNote: input.internalNote }
          : {}),
        ...(input.nextStatus === WarrantyStatus.RESOLVED
          ? { resolvedAt: now }
          : {}),
        ...(input.nextStatus === WarrantyStatus.CLOSED
          ? { closedAt: now }
          : {}),
        ...(input.nextStatus === WarrantyStatus.REJECTED
          ? { rejectedAt: now }
          : {}),
      },
    });
    if (updated.count !== 1) {
      throw new CatalogError('CONCURRENT_MODIFICATION');
    }

    await tx.auditLog.create({
      data: {
        actorUserId: transitionActor.userId,
        action: 'warranty.state-transitioned',
        targetType: 'warranty_request',
        targetId: current.id,
        before: { status: current.status, version: current.version },
        after: {
          status: input.nextStatus,
          version: current.version + 1,
          assignedStaffUserId: isProcessor
            ? transitionActor.userId
            : current.assignedStaffUserId,
        },
        reason: input.reason,
        requestId,
      },
    });

    return tx.warrantyRequest.findUniqueOrThrow({
      where: { id: current.id },
      select: warrantyDetailSelect,
    });
  });
}

export async function addWarrantyEvidence(
  actor: IdentityActor | null,
  warrantyRequestId: string,
  input: WarrantyEvidenceInput,
  requestId: string,
) {
  const customer = requireCustomerMutation(actor);
  const owned = await prisma.warrantyRequest.findFirst({
    where: {
      id: warrantyRequestId,
      customerUserId: customer.userId,
      status: { in: [WarrantyStatus.SUBMITTED, WarrantyStatus.IN_REVIEW] },
    },
    select: { id: true, status: true, version: true },
  });
  if (!owned) throw new CatalogError('NOT_FOUND');
  if (owned.version !== input.expectedVersion) {
    throw new CatalogError('CONCURRENT_MODIFICATION');
  }

  const storage = getEvidenceStorage();
  const upload: StorageUploadInput = {
    filename: input.filename,
    contentType: input.contentType,
    contentBase64: input.contentBase64,
    purpose: 'warranty',
  };
  return uploadAndPersist(storage, upload, async (uploaded) =>
    prisma.$transaction(async (tx) => {
      const versionUpdate = await tx.warrantyRequest.updateMany({
        where: {
          id: owned.id,
          customerUserId: customer.userId,
          status: owned.status,
          version: input.expectedVersion,
        },
        data: { version: { increment: 1 } },
      });
      if (versionUpdate.count !== 1) {
        throw new CatalogError('CONCURRENT_MODIFICATION');
      }
      const evidence = await tx.warrantyEvidence.create({
        data: {
          warrantyRequestId: owned.id,
          storageKey: uploaded.storageKey,
          mimeType: uploaded.contentType,
          byteSize: uploaded.byteSize,
        },
        select: { id: true, mimeType: true, byteSize: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: customer.userId,
          action: 'warranty.evidence-added',
          targetType: 'warranty_request',
          targetId: owned.id,
          before: { status: owned.status, version: owned.version },
          after: {
            status: owned.status,
            version: owned.version + 1,
            evidenceId: evidence.id,
            mimeType: uploaded.contentType,
            byteSize: uploaded.byteSize,
            checksumSha256: uploaded.checksumSha256,
          },
          requestId,
        },
      });
      return { ...evidence, warrantyVersion: owned.version + 1 };
    }),
  );
}

export async function getWarrantyEvidencePreview(
  actor: IdentityActor | null,
  warrantyRequestId: string,
  evidenceId: string,
) {
  if (!actor) throw new CatalogError('UNAUTHENTICATED');
  const evidence = await prisma.warrantyEvidence.findFirst({
    where: { id: evidenceId, warrantyRequestId },
    select: {
      storageKey: true,
      mimeType: true,
      byteSize: true,
      warrantyRequest: { select: { customerUserId: true } },
    },
  });
  const canRead =
    evidence &&
    ((actorHasRole(actor, customerRoles) &&
      evidence.warrantyRequest.customerUserId === actor.userId) ||
      actorHasRole(actor, operationsReadRoles));
  if (!canRead || !evidence) throw new CatalogError('NOT_FOUND');
  const content = await getEvidenceStorage().download(evidence.storageKey);
  if (!content) throw new CatalogError('NOT_FOUND');
  if (content.length !== evidence.byteSize) {
    throw new StorageProviderError(
      'Stored warranty evidence size does not match metadata.',
    );
  }
  return { content, mimeType: evidence.mimeType };
}

export async function listWarrantyAudit(
  actor: IdentityActor | null,
  warrantyRequestId: string,
  input: WarrantyAuditListInput,
) {
  const customer = requireCustomerRead(actor);
  const owned = await prisma.warrantyRequest.findFirst({
    where: { id: warrantyRequestId, customerUserId: customer.userId },
    select: { id: true },
  });
  if (!owned) throw new CatalogError('NOT_FOUND');

  const rows = await prisma.auditLog.findMany({
    where: { targetType: 'warranty_request', targetId: owned.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
    select: {
      id: true,
      action: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
  const hasNext = rows.length > input.limit;
  const items = rows.slice(0, input.limit);
  return {
    items,
    nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null,
  };
}
