import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CatalogError } from '@/modules/catalog';
import {
  withApiHandler,
  withJsonMutation,
  withMutation,
  withOperationsJsonMutation,
} from '@/shared/http/api-handler';
import { clearRateLimitsForTest } from '@/modules/identity/infrastructure/rate-limiter';

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
        requestId: 'order-transition-test',
      },
    });
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
});
