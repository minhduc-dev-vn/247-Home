import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  configureStructuredLogger,
  resetStructuredLoggerForTest,
  type StructuredLogger,
} from '@/shared/observability/logger';

const getCurrentActor = vi.hoisted(() => vi.fn());
const getPublicImage = vi.hoisted(() => vi.fn());
const databaseIsReachable = vi.hoisted(() => vi.fn());

vi.mock('@/shared/auth/server', () => ({ getCurrentActor }));
vi.mock('@/shared/db/readiness', () => ({ databaseIsReachable }));
vi.mock('@/modules/catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/catalog')>()),
  getPublicImage,
}));

import { GET as readyRoute } from '../../app/api/ready/route';
import { GET as meRoute } from '../../app/api/v1/me/route';
import { GET as productImageRoute } from '../../app/api/v1/product-images/[id]/route';
import { GET as userRoute } from '../../app/api/v1/users/[id]/route';

const outage = () => {
  throw new Error('postgres connection terminated unexpectedly');
};

async function expectJsonErrorEnvelope(response: Response) {
  expect(response.status).toBe(500);
  expect(response.headers.get('Content-Type')).toContain('application/json');
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: 'INTERNAL_ERROR',
      requestId: expect.stringMatching(/^req_/),
    },
  });
}

describe('unwrapped routes return the JSON error envelope on failure', () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetStructuredLoggerForTest();
  });

  it('GET /api/v1/me', async () => {
    getCurrentActor.mockImplementation(outage);

    await expectJsonErrorEnvelope(
      await meRoute(new Request('http://localhost/api/v1/me')),
    );
  });

  it('GET /api/v1/users/[id]', async () => {
    getCurrentActor.mockImplementation(outage);

    await expectJsonErrorEnvelope(
      await userRoute(new Request('http://localhost/api/v1/users/abc'), {
        params: Promise.resolve({ id: 'abc' }),
      }),
    );
  });

  it('GET /api/v1/product-images/[id]', async () => {
    getPublicImage.mockImplementation(outage);

    await expectJsonErrorEnvelope(
      await productImageRoute(
        new Request('http://localhost/api/v1/product-images/abc'),
        { params: Promise.resolve({ id: 'abc' }) },
      ),
    );
  });

  it('GET /api/ready', async () => {
    databaseIsReachable.mockImplementation(outage);

    await expectJsonErrorEnvelope(
      await readyRoute(new Request('http://localhost/api/ready')),
    );
  });

  it('keeps the documented readiness payload when the database is reachable', async () => {
    databaseIsReachable.mockResolvedValue(true);
    const info = vi.fn<StructuredLogger['info']>();
    configureStructuredLogger({
      info,
      warn: vi.fn<StructuredLogger['warn']>(),
      error: vi.fn<StructuredLogger['error']>(),
    });

    const response = await readyRoute(
      new Request('http://localhost/api/ready'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    await expect(response.json()).resolves.toMatchObject({
      data: { status: 'ready' },
    });
    expect(info).not.toHaveBeenCalled();
  });

  it('keeps the documented readiness failure payload and still logs it', async () => {
    databaseIsReachable.mockResolvedValue(false);
    const info = vi.fn<StructuredLogger['info']>();
    configureStructuredLogger({
      info,
      warn: vi.fn<StructuredLogger['warn']>(),
      error: vi.fn<StructuredLogger['error']>(),
    });

    const response = await readyRoute(
      new Request('http://localhost/api/ready'),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INTERNAL_ERROR', message: 'Dịch vụ chưa sẵn sàng.' },
    });
    expect(info).toHaveBeenCalledWith(
      'http.request.completed',
      expect.objectContaining({ route: '/api/ready', status: 503 }),
    );
  });
});
