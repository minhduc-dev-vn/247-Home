import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CatalogError } from '@/modules/catalog';
import { StorageProviderError } from '@/modules/storage';
import {
  withApiHandler,
  withJsonMutation,
  withMutation,
  withOperationsJsonMutation,
} from '@/shared/http/api-handler';
import { clearRateLimitsForTest } from '@/modules/identity/infrastructure/rate-limiter';
import {
  configureStructuredLogger,
  resetStructuredLoggerForTest,
  type ApplicationErrorLog,
  type StructuredLogger,
} from '@/shared/observability/logger';

describe('API conflict responses', () => {
  it.each([
    'CONCURRENT_MODIFICATION',
    'INVENTORY_CONFLICT',
    'INVALID_STATE_TRANSITION',
  ] as const)('preserves the structured %s conflict code', async (code) => {
    const response = await withApiHandler(
      new Request('http://localhost/api/test', {
        headers: { 'x-request-id': 'order-transition-test' },
      }),
      async () => {
        throw new CatalogError(code);
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code,
        requestId: expect.stringMatching(/^req_/),
      },
    });
  });
});

describe('server failure diagnostics', () => {
  afterEach(() => resetStructuredLoggerForTest());

  function captureLogs() {
    const info = vi.fn<StructuredLogger['info']>();
    const warn = vi.fn<StructuredLogger['warn']>();
    const error = vi.fn<StructuredLogger['error']>();
    configureStructuredLogger({ info, warn, error });
    return {
      applicationError: () =>
        error.mock.calls.find(
          ([event]) => event === 'application.error',
        )?.[1] as ApplicationErrorLog | undefined,
      requestLogs: () =>
        info.mock.calls.filter(([event]) => event === 'http.request.completed'),
    };
  }

  it('logs the stack of an unexpected error without leaking it to the client', async () => {
    const logs = captureLogs();

    const response = await withApiHandler(
      new Request('http://localhost/api/test', {
        headers: { 'x-request-id': 'client-supplied' },
      }),
      async () => {
        throw new Error('database connection lost');
      },
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Không thể xử lý yêu cầu lúc này.',
        fieldErrors: {},
        details: {},
        requestId: expect.stringMatching(/^req_/),
      },
    });
    expect(JSON.stringify(body)).not.toContain('database connection lost');
    expect(JSON.stringify(body)).not.toContain('at ');

    const logged = logs.applicationError();
    expect(logged).toMatchObject({
      route: '/api/test',
      category: 'unhandled-exception',
      errorCode: 'Error',
      errorMessage: 'database connection lost',
      clientRequestId: 'client-supplied',
    });
    expect(logged?.stack).toMatch(/at .+/);
    expect(logged?.requestId).toMatch(/^req_/);
  });

  it('logs a storage outage before returning the generic 503 envelope', async () => {
    const logs = captureLogs();

    const response = await withApiHandler(
      new Request('http://localhost/api/evidence'),
      async () => {
        throw new StorageProviderError('bucket 247-evidence unreachable');
      },
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Không thể xử lý tệp lúc này.',
      },
    });
    expect(JSON.stringify(body)).not.toContain('247-evidence');

    expect(logs.applicationError()).toMatchObject({
      category: 'storage-unavailable',
      errorMessage: 'bucket 247-evidence unreachable',
    });
  });

  it('records a thrown non-error value without crashing the handler', async () => {
    const logs = captureLogs();

    const response = await withApiHandler(
      new Request('http://localhost/api/test'),
      async () => {
        throw 'plain string failure';
      },
    );

    expect(response.status).toBe(500);
    expect(logs.applicationError()).toMatchObject({
      errorCode: 'UNKNOWN_ERROR',
      errorMessage: 'Non-error value thrown.',
    });
  });

  it.each(['/api/ready', '/api/health'])(
    'stays silent for a healthy %s probe',
    async (route) => {
      const logs = captureLogs();

      const response = await withApiHandler(
        new Request(`http://localhost${route}`),
        async () => Response.json({ data: { status: 'ready' } }),
      );

      expect(response.status).toBe(200);
      expect(logs.requestLogs()).toHaveLength(0);
    },
  );

  it('still logs a failing readiness probe', async () => {
    const logs = captureLogs();

    const response = await withApiHandler(
      new Request('http://localhost/api/ready'),
      async () => Response.json({ error: {} }, { status: 503 }),
    );

    expect(response.status).toBe(503);
    expect(logs.requestLogs()).toHaveLength(1);
    expect(logs.requestLogs()[0][1]).toMatchObject({
      route: '/api/ready',
      status: 503,
    });
  });

  it('keeps logging non-probe routes that succeed', async () => {
    const logs = captureLogs();

    await withApiHandler(
      new Request('http://localhost/api/v1/products'),
      async () => Response.json({ data: [] }),
    );

    expect(logs.requestLogs()).toHaveLength(1);
  });

  it('does not log an application error for a handled domain conflict', async () => {
    const logs = captureLogs();

    const response = await withApiHandler(
      new Request('http://localhost/api/test'),
      async () => {
        throw new CatalogError('NOT_FOUND');
      },
    );

    expect(response.status).toBe(404);
    expect(logs.applicationError()).toBeUndefined();
  });
});

describe('Operations mutation security contract', () => {
  const schema = z.object({ action: z.string() }).strict();

  beforeEach(() => {
    clearRateLimitsForTest();
  });

  function request(
    headers: HeadersInit = {},
    body = JSON.stringify({ action: 'test' }),
  ) {
    return new Request('http://localhost:3000/api/v1/operations/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        ...headers,
      },
      body,
    });
  }

  async function mutate(requestToHandle: Request, action = vi.fn()) {
    const response = await withOperationsJsonMutation(
      requestToHandle,
      schema,
      { maxBodyBytes: 64, rateLimitScope: 'operations-security-test' },
      async () => {
        action();
        return Response.json({ data: {} });
      },
    );
    return { action, response };
  }

  it('rejects an unapproved origin before the mutation runs', async () => {
    const result = await mutate(request({ Origin: 'https://evil.example' }));
    expect(result.response.status).toBe(403);
    expect(result.action).not.toHaveBeenCalled();
    await expect(result.response.json()).resolves.toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
  });

  it('rejects a non-JSON content type before the mutation runs', async () => {
    const result = await mutate(
      request({ 'Content-Type': 'application/jsonp' }),
    );
    expect(result.response.status).toBe(415);
    expect(result.action).not.toHaveBeenCalled();
    await expect(result.response.json()).resolves.toMatchObject({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE' },
    });
  });

  it('rejects a body that exceeds the configured size limit', async () => {
    const result = await mutate(
      request({}, JSON.stringify({ action: 'x'.repeat(100) })),
    );
    expect(result.response.status).toBe(413);
    expect(result.action).not.toHaveBeenCalled();
    await expect(result.response.json()).resolves.toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE' },
    });
  });

  it('returns a structured rate-limit response without calling the mutation', async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = await mutate(request());
      expect(result.response.status).toBe(200);
    }
    const limited = await mutate(request());
    expect(limited.response.status).toBe(429);
    expect(limited.response.headers.get('Retry-After')).toMatch(/^[1-9]\d*$/);
    expect(limited.action).not.toHaveBeenCalled();
    await expect(limited.response.json()).resolves.toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
  });

  it('does not trust spoofed forwarding headers unless proxy trust is explicit', async () => {
    const previous = process.env.TRUST_PROXY_HEADERS;
    process.env.TRUST_PROXY_HEADERS = 'false';
    try {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const result = await withOperationsJsonMutation(
          request({ 'X-Forwarded-For': `198.51.100.${attempt + 1}` }),
          schema,
          { rateLimitScope: 'proxy-spoof-test' },
          async () => Response.json({ data: {} }),
        );
        expect(result.status).toBe(200);
      }
      const limited = await withOperationsJsonMutation(
        request({ 'X-Forwarded-For': '203.0.113.200' }),
        schema,
        { rateLimitScope: 'proxy-spoof-test' },
        async () => Response.json({ data: {} }),
      );
      expect(limited.status).toBe(429);
    } finally {
      if (previous === undefined) delete process.env.TRUST_PROXY_HEADERS;
      else process.env.TRUST_PROXY_HEADERS = previous;
    }
  });
});

describe('shared sensitive mutation security contract', () => {
  const schema = z.object({ value: z.string() }).strict();

  beforeEach(() => {
    clearRateLimitsForTest();
  });

  it('applies the same origin, type, size, rate and no-store protections', async () => {
    const action = vi.fn(async () => Response.json({ data: {} }));
    const response = await withJsonMutation(
      new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ value: 'ok' }),
      }),
      schema,
      { rateLimitScope: 'shared-security-test' },
      action,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(action).toHaveBeenCalledOnce();

    const forbidden = await withJsonMutation(
      new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example',
        },
        body: JSON.stringify({ value: 'no' }),
      }),
      schema,
      { rateLimitScope: 'shared-security-test' },
      action,
    );
    expect(forbidden.status).toBe(403);
  });

  it('rejects a body on no-body mutations before the action runs', async () => {
    const action = vi.fn(async () => Response.json({ data: {} }));
    const response = await withMutation(
      new Request('http://localhost:3000/api/test', {
        method: 'DELETE',
        headers: { Origin: 'http://localhost:3000' },
        body: 'unexpected',
      }),
      { rateLimitScope: 'shared-empty-body-test' },
      action,
    );

    expect(response.status).toBe(413);
    expect(action).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE' },
    });
  });

  it('accepts the external Render service origin supplied by the platform', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RENDER', 'true');
    vi.stubEnv('RENDER_EXTERNAL_URL', 'https://247-home-staging.onrender.com');
    vi.stubEnv('NEXTAUTH_URL', 'https://247home.example');
    vi.stubEnv('APP_ORIGIN', 'https://247home.example');
    vi.stubEnv('DEPLOYMENT_ENV', 'staging');
    vi.stubEnv('RENDER_STAGING_SINGLE_INSTANCE', 'true');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true');
    vi.stubEnv('TRUSTED_PROXY_PROVIDER', 'render');
    try {
      const action = vi.fn(async () => Response.json({ data: {} }));
      const response = await withJsonMutation(
        new Request('https://247-home-staging.onrender.com/api/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://247-home-staging.onrender.com',
            'X-Forwarded-For': '203.0.113.20',
          },
          body: JSON.stringify({ value: 'ok' }),
        }),
        schema,
        { rateLimitScope: 'render-origin-test' },
        action,
      );

      expect(response.status).toBe(200);
      expect(action).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllEnvs();
      clearRateLimitsForTest();
    }
  });
});
