import { WarrantyStatus } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import {
  addWarrantyEvidence,
  createWarrantyRequest,
  getWarrantyEvidencePreview,
  getWarrantyRequest,
  listEligibleWarrantyItems,
  listWarrantyAudit,
  listWarrantyRequests,
  transitionWarrantyRequest,
} from '@/modules/warranty';
import { prisma } from '@/shared/db/client';
import {
  createWarrantyFixture,
  type WarrantyFixture,
} from '../fixtures/warranty';

const validPng = 'iVBORw0KGgo=';

async function withFixture(run: (fixture: WarrantyFixture) => Promise<void>) {
  const fixture = await createWarrantyFixture();
  try {
    await run(fixture);
  } finally {
    await fixture.cleanup();
  }
}

function createInput(
  orderItemId: string,
  coverageType: 'DEVICE' | 'INSTALLATION' = 'DEVICE',
) {
  return {
    orderItemId,
    coverageType,
    issueType: 'DEVICE_NOT_WORKING' as const,
    description: 'The device no longer powers on after normal household use.',
    contactPhone: '0900000000',
  };
}

describe.sequential('customer warranty integration', () => {
  afterAll(async () => prisma.$disconnect());

  it('creates only eligible owner requests, snapshots eligibility, and prevents duplicates', async () => {
    await withFixture(async (fixture) => {
      const created = await createWarrantyRequest(
        fixture.users.customerA.actor,
        createInput(fixture.orderItems.eligibleDevice),
        `${fixture.namespace}-create`,
      );
      expect(created).toMatchObject({
        coverageType: 'DEVICE',
        status: 'SUBMITTED',
        version: 1,
        contactPhone: '0900000000',
      });
      expect(created.warrantyExpiresAt.getTime()).toBeGreaterThan(
        created.warrantyStartsAt.getTime(),
      );
      await expect(
        createWarrantyRequest(
          fixture.users.customerA.actor,
          createInput(fixture.orderItems.eligibleDevice),
          `${fixture.namespace}-duplicate`,
        ),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'DUPLICATE_WARRANTY_REQUEST',
      });
      await expect(
        createWarrantyRequest(
          fixture.users.customerA.actor,
          createInput(fixture.orderItems.incomplete),
          `${fixture.namespace}-incomplete`,
        ),
      ).rejects.toMatchObject({ code: 'WARRANTY_NOT_ELIGIBLE' });
      await expect(
        createWarrantyRequest(
          fixture.users.customerA.actor,
          createInput(fixture.orderItems.otherCustomer),
          `${fixture.namespace}-idor-create`,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        createWarrantyRequest(
          fixture.users.customerA.actor,
          createInput(fixture.orderItems.eligibleDevice, 'INSTALLATION'),
          `${fixture.namespace}-no-package`,
        ),
      ).rejects.toMatchObject({
        code: 'WARRANTY_NOT_ELIGIBLE',
        message: 'NO_INSTALLATION_PACKAGE',
      });
    });
  });

  it('projects only server-verified eligible items for the customer create form', async () => {
    await withFixture(async (fixture) => {
      const before = await listEligibleWarrantyItems(
        fixture.users.customerA.actor,
      );
      expect(before).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            orderItemId: fixture.orderItems.eligibleDevice,
            coverageType: 'DEVICE',
          }),
          expect.objectContaining({
            orderItemId: fixture.orderItems.eligibleInstallation,
            coverageType: 'INSTALLATION',
          }),
        ]),
      );
      expect(before).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            orderItemId: fixture.orderItems.incomplete,
          }),
          expect.objectContaining({
            orderItemId: fixture.orderItems.otherCustomer,
          }),
        ]),
      );

      await createWarrantyRequest(
        fixture.users.customerA.actor,
        createInput(fixture.orderItems.eligibleDevice),
        `${fixture.namespace}-projection-create`,
      );
      const after = await listEligibleWarrantyItems(
        fixture.users.customerA.actor,
      );
      expect(after).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            orderItemId: fixture.orderItems.eligibleDevice,
            coverageType: 'DEVICE',
          }),
        ]),
      );
    });
  });

  it('replays concurrent create requests by idempotency key without duplicate audit', async () => {
    await withFixture(async (fixture) => {
      const input = {
        orderId: fixture.orders.eligible,
        productId: fixture.productId,
        coverageType: 'DEVICE' as const,
        issueType: 'DEVICE_NOT_WORKING' as const,
        description:
          'The device no longer powers on after normal household use.',
      };
      const idempotencyKey = `${fixture.namespace}-idempotency`;
      const results = await Promise.all([
        createWarrantyRequest(
          fixture.users.customerA.actor,
          input,
          `${fixture.namespace}-create-a`,
          idempotencyKey,
        ),
        createWarrantyRequest(
          fixture.users.customerA.actor,
          input,
          `${fixture.namespace}-create-b`,
          idempotencyKey,
        ),
      ]);
      expect(new Set(results.map((result) => result.id)).size).toBe(1);
      expect(results.filter((result) => result.replayed)).toHaveLength(1);
      const createdId = results.at(0)?.id;
      if (!createdId) throw new Error('Idempotent create returned no request.');
      await expect(
        prisma.auditLog.count({
          where: {
            targetType: 'warranty_request',
            targetId: createdId,
            action: 'warranty.request-created',
          },
        }),
      ).resolves.toBe(1);
      await expect(
        createWarrantyRequest(
          fixture.users.customerA.actor,
          { ...input, description: `${input.description} Changed payload.` },
          `${fixture.namespace}-changed-payload`,
          idempotencyKey,
        ),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    });
  });

  it('scopes list, detail, and audit to the customer owner with cursor pagination', async () => {
    await withFixture(async (fixture) => {
      const first = await createWarrantyRequest(
        fixture.users.customerA.actor,
        createInput(fixture.orderItems.eligibleDevice),
        `${fixture.namespace}-first`,
      );
      await createWarrantyRequest(
        fixture.users.customerA.actor,
        createInput(fixture.orderItems.eligibleInstallation, 'INSTALLATION'),
        `${fixture.namespace}-second`,
      );
      const pageOne = await listWarrantyRequests(
        fixture.users.customerA.actor,
        { limit: 1 },
      );
      expect(pageOne.items).toHaveLength(1);
      expect(pageOne.nextCursor).not.toBeNull();
      if (!pageOne.nextCursor) throw new Error('Expected a second page.');
      const pageTwo = await listWarrantyRequests(
        fixture.users.customerA.actor,
        { limit: 1, cursor: pageOne.nextCursor },
      );
      expect(pageTwo.items).toHaveLength(1);
      expect(pageTwo.items[0]?.id).not.toBe(pageOne.items[0]?.id);
      await expect(
        getWarrantyRequest(fixture.users.customerB.actor, first.id),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        listWarrantyAudit(fixture.users.customerB.actor, first.id, {
          limit: 25,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        listWarrantyRequests(fixture.users.customerB.actor, { limit: 25 }),
      ).resolves.toEqual({ items: [], nextCursor: null });
    });
  });

  it('enforces the versioned state machine and writes redacted audit events', async () => {
    await withFixture(async (fixture) => {
      const created = await createWarrantyRequest(
        fixture.users.customerA.actor,
        createInput(fixture.orderItems.eligibleDevice),
        `${fixture.namespace}-create`,
      );
      const reviewing = await transitionWarrantyRequest(
        fixture.users.staff.actor,
        created.id,
        {
          expectedVersion: 1,
          nextStatus: 'IN_REVIEW',
          reason: 'Initial warranty review',
        },
        `${fixture.namespace}-review`,
      );
      expect(reviewing).toMatchObject({ status: 'IN_REVIEW', version: 2 });
      const resolved = await transitionWarrantyRequest(
        fixture.users.manager.actor,
        created.id,
        {
          expectedVersion: 2,
          nextStatus: 'RESOLVED',
          reason: 'Approved replacement',
          publicResolution: 'A replacement device has been approved.',
          internalNote: 'Test-only processor note.',
        },
        `${fixture.namespace}-resolve`,
      );
      expect(resolved).toMatchObject({ status: 'RESOLVED', version: 3 });
      const closed = await transitionWarrantyRequest(
        fixture.users.customerA.actor,
        created.id,
        {
          expectedVersion: 3,
          nextStatus: 'CLOSED',
          reason: 'Resolution received',
        },
        `${fixture.namespace}-close`,
      );
      expect(closed).toMatchObject({ status: 'CLOSED', version: 4 });

      const audit = await listWarrantyAudit(
        fixture.users.customerA.actor,
        created.id,
        { limit: 25 },
      );
      expect(audit.items.map((event) => event.action)).toEqual(
        expect.arrayContaining([
          'warranty.request-created',
          'warranty.state-transitioned',
        ]),
      );
      expect(JSON.stringify(audit)).not.toContain('Test-only processor note');
      expect(JSON.stringify(audit)).not.toContain(created.contactPhone);

      const rejected = await createWarrantyRequest(
        fixture.users.customerA.actor,
        createInput(fixture.orderItems.eligibleInstallation, 'INSTALLATION'),
        `${fixture.namespace}-rejected-create`,
      );
      const rejectedReview = await transitionWarrantyRequest(
        fixture.users.staff.actor,
        rejected.id,
        {
          expectedVersion: 1,
          nextStatus: 'IN_REVIEW',
          reason: 'Review installation claim',
        },
        `${fixture.namespace}-rejected-review`,
      );
      const rejectedResult = await transitionWarrantyRequest(
        fixture.users.manager.actor,
        rejected.id,
        {
          expectedVersion: rejectedReview.version,
          nextStatus: 'REJECTED',
          reason: 'Installation claim not covered',
          publicResolution:
            'The reported condition is outside warranty coverage.',
        },
        `${fixture.namespace}-reject`,
      );
      await expect(
        transitionWarrantyRequest(
          fixture.users.customerA.actor,
          rejected.id,
          {
            expectedVersion: rejectedResult.version,
            nextStatus: 'CLOSED',
            reason: 'Rejection acknowledged',
          },
          `${fixture.namespace}-rejected-close`,
        ),
      ).resolves.toMatchObject({ status: 'CLOSED', version: 4 });
    });
  });

  it('allows exactly one concurrent transition for the same expected version', async () => {
    await withFixture(async (fixture) => {
      const created = await createWarrantyRequest(
        fixture.users.customerA.actor,
        createInput(fixture.orderItems.eligibleDevice),
        `${fixture.namespace}-create`,
      );
      const results = await Promise.allSettled([
        transitionWarrantyRequest(
          fixture.users.staff.actor,
          created.id,
          {
            expectedVersion: 1,
            nextStatus: 'IN_REVIEW',
            reason: 'Concurrent staff review',
          },
          `${fixture.namespace}-race-a`,
        ),
        transitionWarrantyRequest(
          fixture.users.manager.actor,
          created.id,
          {
            expectedVersion: 1,
            nextStatus: 'IN_REVIEW',
            reason: 'Concurrent manager review',
          },
          `${fixture.namespace}-race-b`,
        ),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      await expect(
        prisma.warrantyRequest.findUniqueOrThrow({ where: { id: created.id } }),
      ).resolves.toMatchObject({
        status: WarrantyStatus.IN_REVIEW,
        version: 2,
      });
      await expect(
        prisma.auditLog.count({
          where: {
            targetType: 'warranty_request',
            targetId: created.id,
            action: 'warranty.state-transitioned',
          },
        }),
      ).resolves.toBe(1);
    });
  });

  it('denies technician/admin mutation and rejects stale or invalid transitions', async () => {
    await withFixture(async (fixture) => {
      const created = await createWarrantyRequest(
        fixture.users.customerA.actor,
        createInput(fixture.orderItems.eligibleDevice),
        `${fixture.namespace}-create`,
      );
      for (const actor of [
        fixture.users.technician.actor,
        fixture.users.admin.actor,
      ]) {
        await expect(
          transitionWarrantyRequest(
            actor,
            created.id,
            {
              expectedVersion: 1,
              nextStatus: 'IN_REVIEW',
              reason: 'Unauthorized transition',
            },
            `${fixture.namespace}-denied`,
          ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      }
      await expect(
        transitionWarrantyRequest(
          fixture.users.manager.actor,
          created.id,
          {
            expectedVersion: 2,
            nextStatus: 'IN_REVIEW',
            reason: 'Stale version transition',
          },
          `${fixture.namespace}-stale`,
        ),
      ).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' });
      await expect(
        transitionWarrantyRequest(
          fixture.users.manager.actor,
          created.id,
          {
            expectedVersion: 1,
            nextStatus: 'RESOLVED',
            reason: 'Skipped review transition',
            publicResolution: 'This transition must not be persisted.',
          },
          `${fixture.namespace}-skip`,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });

      const reviewing = await transitionWarrantyRequest(
        fixture.users.staff.actor,
        created.id,
        {
          expectedVersion: 1,
          nextStatus: 'IN_REVIEW',
          reason: 'Prepare customer field authorization test',
        },
        `${fixture.namespace}-review`,
      );
      const resolved = await transitionWarrantyRequest(
        fixture.users.manager.actor,
        created.id,
        {
          expectedVersion: reviewing.version,
          nextStatus: 'RESOLVED',
          reason: 'Resolve customer field authorization test',
          publicResolution: 'Approved test resolution.',
        },
        `${fixture.namespace}-resolve`,
      );
      await expect(
        transitionWarrantyRequest(
          fixture.users.customerA.actor,
          created.id,
          {
            expectedVersion: resolved.version,
            nextStatus: 'CLOSED',
            reason: 'Attempt to overwrite processor fields',
            publicResolution: 'Customer supplied replacement resolution.',
            internalNote: 'Customer supplied internal note.',
          },
          `${fixture.namespace}-field-escalation`,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  it('uploads private evidence once under concurrency and enforces preview authorization', async () => {
    await withFixture(async (fixture) => {
      const created = await createWarrantyRequest(
        fixture.users.customerA.actor,
        createInput(fixture.orderItems.eligibleDevice),
        `${fixture.namespace}-create`,
      );
      const results = await Promise.allSettled([
        addWarrantyEvidence(
          fixture.users.customerA.actor,
          created.id,
          {
            expectedVersion: 1,
            filename: 'warranty-a.png',
            contentType: 'image/png',
            contentBase64: validPng,
          },
          `${fixture.namespace}-evidence-a`,
        ),
        addWarrantyEvidence(
          fixture.users.customerA.actor,
          created.id,
          {
            expectedVersion: 1,
            filename: 'warranty-b.png',
            contentType: 'image/png',
            contentBase64: validPng,
          },
          `${fixture.namespace}-evidence-b`,
        ),
      ]);
      const success = results.find((result) => result.status === 'fulfilled');
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      if (!success || success.status !== 'fulfilled') {
        throw new Error('Expected one successful warranty evidence upload.');
      }
      const evidenceId = success.value.id;
      await expect(
        prisma.warrantyEvidence.count({
          where: { warrantyRequestId: created.id },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.warrantyEvidence.findFirstOrThrow({
          where: { warrantyRequestId: created.id },
          select: { storageKey: true },
        }),
      ).resolves.toMatchObject({
        storageKey: expect.stringMatching(/^warranty-evidence\//),
      });
      await expect(
        prisma.warrantyRequest.findUniqueOrThrow({ where: { id: created.id } }),
      ).resolves.toMatchObject({ version: 2 });
      await expect(
        getWarrantyEvidencePreview(
          fixture.users.customerA.actor,
          created.id,
          evidenceId,
        ),
      ).resolves.toMatchObject({
        mimeType: 'image/png',
        content: Buffer.from(validPng, 'base64'),
      });
      await expect(
        getWarrantyEvidencePreview(
          fixture.users.admin.actor,
          created.id,
          evidenceId,
        ),
      ).resolves.toMatchObject({ mimeType: 'image/png' });
      for (const actor of [
        fixture.users.customerB.actor,
        fixture.users.technician.actor,
      ]) {
        await expect(
          getWarrantyEvidencePreview(actor, created.id, evidenceId),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      }
      await expect(
        prisma.auditLog.count({
          where: {
            targetType: 'warranty_request',
            targetId: created.id,
            action: 'warranty.evidence-added',
          },
        }),
      ).resolves.toBe(1);
    });
  });
});
