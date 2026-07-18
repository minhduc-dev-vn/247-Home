import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as warrantyAuditGet } from '../../app/api/v1/warranty/[id]/audit/route';
import { GET as warrantyEvidenceGet } from '../../app/api/v1/warranty/[id]/evidence/[evidenceId]/route';
import { POST as warrantyEvidencePost } from '../../app/api/v1/warranty/[id]/evidence/route';
import { GET as warrantyDetailGet } from '../../app/api/v1/warranty/[id]/route';
import { PATCH as warrantyStatePatch } from '../../app/api/v1/warranty/[id]/state/route';
import {
  GET as warrantyListGet,
  POST as warrantyCreatePost,
} from '../../app/api/v1/warranty/route';
import { type IdentityActor } from '@/modules/identity';
import { clearRateLimitsForTest } from '@/modules/identity/infrastructure/rate-limiter';
import { prisma } from '@/shared/db/client';
import {
  createWarrantyFixture,
  type WarrantyFixture,
} from '../fixtures/warranty';

const authState = vi.hoisted(() => ({
  actor: null as IdentityActor | null,
}));

vi.mock('@/shared/auth/server', () => ({
  getCurrentActor: async () => authState.actor,
}));

const origin = 'http://127.0.0.1:3000';
const validPng = 'iVBORw0KGgo=';

function jsonRequest(
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown,
  idempotencyKey?: string,
) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Origin: origin,
  });
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  return new Request(`${origin}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

async function payload(response: Response) {
  return response.json() as Promise<{
    data?: Record<string, unknown>;
    error?: { code: string };
  }>;
}

describe.sequential('customer warranty HTTP contract', () => {
  let fixture: WarrantyFixture;

  beforeEach(() => clearRateLimitsForTest());

  afterAll(async () => {
    authState.actor = null;
    await prisma.$disconnect();
  });

  it('returns the documented owner-scoped lifecycle and evidence responses', async () => {
    fixture = await createWarrantyFixture();
    try {
      authState.actor = fixture.users.customerA.actor;
      const createKey = `${fixture.namespace}-http-create`;
      const createdResponse = await warrantyCreatePost(
        jsonRequest(
          '/api/v1/warranty',
          'POST',
          {
            orderId: fixture.orders.eligible,
            productId: fixture.productId,
            description:
              'The device no longer powers on after normal household use.',
          },
          createKey,
        ),
      );
      expect(createdResponse.status).toBe(201);
      expect(createdResponse.headers.get('cache-control')).toBe(
        'private, no-store',
      );
      const created = (await payload(createdResponse)).data;
      const warrantyId = created?.id;
      expect(typeof warrantyId).toBe('string');
      if (typeof warrantyId !== 'string') {
        throw new Error('Warranty API did not return an id.');
      }

      const listResponse = await warrantyListGet(
        new Request(`${origin}/api/v1/warranty?limit=1`),
      );
      expect(listResponse.status).toBe(200);
      expect(listResponse.headers.get('cache-control')).toBe(
        'private, no-store',
      );

      authState.actor = fixture.users.customerB.actor;
      const deniedDetail = await warrantyDetailGet(
        new Request(`${origin}/api/v1/warranty/${warrantyId}`),
        { params: Promise.resolve({ id: warrantyId }) },
      );
      expect(deniedDetail.status).toBe(404);
      expect((await payload(deniedDetail)).error?.code).toBe('NOT_FOUND');

      authState.actor = fixture.users.staff.actor;
      const reviewResponse = await warrantyStatePatch(
        jsonRequest(`/api/v1/warranty/${warrantyId}/state`, 'PATCH', {
          expectedVersion: 1,
          nextStatus: 'IN_REVIEW',
          reason: 'HTTP contract review',
        }),
        { params: Promise.resolve({ id: warrantyId }) },
      );
      expect(reviewResponse.status).toBe(200);

      const staleResponse = await warrantyStatePatch(
        jsonRequest(`/api/v1/warranty/${warrantyId}/state`, 'PATCH', {
          expectedVersion: 1,
          nextStatus: 'RESOLVED',
          reason: 'Stale HTTP request',
          publicResolution: 'This response must not be committed.',
        }),
        { params: Promise.resolve({ id: warrantyId }) },
      );
      expect(staleResponse.status).toBe(409);
      expect((await payload(staleResponse)).error?.code).toBe(
        'CONCURRENT_MODIFICATION',
      );

      authState.actor = fixture.users.customerA.actor;
      const evidenceResponse = await warrantyEvidencePost(
        jsonRequest(`/api/v1/warranty/${warrantyId}/evidence`, 'POST', {
          expectedVersion: 2,
          filename: 'warranty.png',
          contentType: 'image/png',
          contentBase64: validPng,
        }),
        { params: Promise.resolve({ id: warrantyId }) },
      );
      expect(evidenceResponse.status).toBe(201);
      const evidenceId = (await payload(evidenceResponse)).data?.id;
      expect(typeof evidenceId).toBe('string');
      if (typeof evidenceId !== 'string') {
        throw new Error('Warranty evidence API did not return an id.');
      }

      const previewResponse = await warrantyEvidenceGet(
        new Request(
          `${origin}/api/v1/warranty/${warrantyId}/evidence/${evidenceId}`,
        ),
        { params: Promise.resolve({ id: warrantyId, evidenceId }) },
      );
      expect(previewResponse.status).toBe(200);
      expect(previewResponse.headers.get('content-type')).toBe('image/png');
      expect(previewResponse.headers.get('cache-control')).toBe(
        'private, no-store',
      );

      const auditResponse = await warrantyAuditGet(
        new Request(`${origin}/api/v1/warranty/${warrantyId}/audit?limit=10`),
        { params: Promise.resolve({ id: warrantyId }) },
      );
      expect(auditResponse.status).toBe(200);
      expect(JSON.stringify(await payload(auditResponse))).toContain(
        'warranty.evidence-added',
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it('returns 400/403/409/415 without exposing another customer resource', async () => {
    fixture = await createWarrantyFixture();
    try {
      authState.actor = fixture.users.customerA.actor;
      const body = {
        orderId: fixture.orders.eligible,
        productId: fixture.productId,
        coverageType: 'DEVICE',
        issueType: 'DEVICE_NOT_WORKING',
        description:
          'The device no longer powers on after normal household use.',
        contactPhone: '0900000000',
      };
      const badOrigin = await warrantyCreatePost(
        new Request(`${origin}/api/v1/warranty`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://attacker.example',
            'Idempotency-Key': `${fixture.namespace}-bad-origin`,
          },
          body: JSON.stringify(body),
        }),
      );
      expect(badOrigin.status).toBe(403);

      const badContentType = await warrantyCreatePost(
        new Request(`${origin}/api/v1/warranty`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            Origin: origin,
            'Idempotency-Key': `${fixture.namespace}-bad-content`,
          },
          body: JSON.stringify(body),
        }),
      );
      expect(badContentType.status).toBe(415);

      const badBody = await warrantyCreatePost(
        jsonRequest(
          '/api/v1/warranty',
          'POST',
          { orderId: 'invalid' },
          `${fixture.namespace}-bad-body`,
        ),
      );
      expect(badBody.status).toBe(400);

      const missingKey = await warrantyCreatePost(
        jsonRequest('/api/v1/warranty', 'POST', body),
      );
      expect(missingKey.status).toBe(400);

      const createKey = `${fixture.namespace}-first-create`;
      const created = await warrantyCreatePost(
        jsonRequest('/api/v1/warranty', 'POST', body, createKey),
      );
      expect(created.status).toBe(201);
      const replay = await warrantyCreatePost(
        jsonRequest('/api/v1/warranty', 'POST', body, createKey),
      );
      expect(replay.status).toBe(200);
      expect(replay.headers.get('idempotent-replayed')).toBe('true');
      expect((await payload(replay)).data?.id).toBe(
        (await payload(created)).data?.id,
      );

      const duplicate = await warrantyCreatePost(
        jsonRequest(
          '/api/v1/warranty',
          'POST',
          body,
          `${fixture.namespace}-different-key`,
        ),
      );
      expect(duplicate.status).toBe(409);

      authState.actor = fixture.users.admin.actor;
      const adminCreate = await warrantyCreatePost(
        jsonRequest(
          '/api/v1/warranty',
          'POST',
          {
            ...body,
            orderId: fixture.orders.otherCustomer,
          },
          `${fixture.namespace}-admin-create`,
        ),
      );
      expect(adminCreate.status).toBe(403);
    } finally {
      await fixture.cleanup();
    }
  });
});
