import { afterEach, describe, expect, it, vi } from 'vitest';

import { withApiHandler } from '@/shared/http/api-handler';
import {
  configureStructuredLogger,
  logApplicationError,
  resetStructuredLoggerForTest,
  type StructuredLogger,
} from '@/shared/observability/logger';

describe('structured HTTP logging', () => {
  afterEach(() => resetStructuredLoggerForTest());

  it('emits only allowlisted request metadata without query or headers', async () => {
    const info = vi.fn<StructuredLogger['info']>();
    configureStructuredLogger({ info });
    const response = await withApiHandler(
      new Request('http://localhost/api/test?token=secret', {
        headers: { Authorization: 'Bearer secret', 'x-request-id': 'safe-id' },
      }),
      async () => Response.json({ ok: true }, { status: 201 }),
    );

    expect(response.status).toBe(201);
    expect(info).toHaveBeenCalledWith(
      'http.request.completed',
      expect.objectContaining({
        requestId: 'safe-id',
        method: 'GET',
        route: '/api/test',
        status: 201,
      }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret');
  });

  it('emits safe application error metadata without request payloads', () => {
    const info = vi.fn<StructuredLogger['info']>();
    configureStructuredLogger({ info });

    logApplicationError({
      requestId: 'request-500',
      route: '/api/v1/auth/register',
      category: 'customer-registration',
      errorCode: 'PrismaClientInitializationError',
    });

    expect(info).toHaveBeenCalledWith('application.error', {
      requestId: 'request-500',
      route: '/api/v1/auth/register',
      category: 'customer-registration',
      errorCode: 'PrismaClientInitializationError',
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain('password');
  });
});
