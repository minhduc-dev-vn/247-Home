import { afterEach, describe, expect, it, vi } from 'vitest';

import { withApiHandler } from '@/shared/http/api-handler';
import {
  configureStructuredLogger,
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
});
