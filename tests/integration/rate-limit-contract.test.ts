import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  clearRateLimitsForTest,
  configureRateLimiter,
  type RateLimiter,
} from '@/modules/identity/infrastructure/rate-limiter';
import { withJsonMutation } from '@/shared/http/api-handler';

const schema = z.object({ value: z.string() }).strict();

function mutationRequest(headers: HeadersInit = {}): Request {
  return new Request('http://localhost:3000/api/v1/rate-limit-contract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      ...headers,
    },
    body: JSON.stringify({ value: 'safe' }),
  });
}

afterEach(() => {
  clearRateLimitsForTest();
  vi.unstubAllEnvs();
});

describe('rate-limit HTTP contract', () => {
  it('maps one shared limiter decision to one success and one safe 429', async () => {
    const calls: string[] = [];
    const sharedLimiter: RateLimiter = {
      consume(_action, key) {
        calls.push(key);
        return calls.length === 1
          ? { allowed: true, retryAfterSeconds: 0 }
          : { allowed: false, retryAfterSeconds: 60 };
      },
    };
    configureRateLimiter(sharedLimiter);
    const firstAction = vi.fn(async () =>
      Response.json({ data: { ok: true } }),
    );
    const secondAction = vi.fn(async () =>
      Response.json({ data: { shouldNotRun: true } }),
    );

    const [first, second] = await Promise.all([
      withJsonMutation(
        mutationRequest(),
        schema,
        { rateLimitScope: 'shared-contract' },
        firstAction,
      ),
      withJsonMutation(
        mutationRequest(),
        schema,
        { rateLimitScope: 'shared-contract' },
        secondAction,
      ),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 429]);
    expect(firstAction).toHaveBeenCalledOnce();
    expect(secondAction).not.toHaveBeenCalled();
    expect(second.headers.get('Retry-After')).toBe('60');
    expect(second.headers.get('Cache-Control')).toBe('private, no-store');
    expect(calls).toEqual([
      'shared-contract:untrusted-client',
      'shared-contract:untrusted-client',
    ]);
  });

  it('keeps spoofed forwarding headers in the same fallback bucket', async () => {
    vi.stubEnv('TRUST_PROXY_HEADERS', 'false');
    const keys: string[] = [];
    const sharedLimiter: RateLimiter = {
      consume(_action, key) {
        keys.push(key);
        return { allowed: true, retryAfterSeconds: 0 };
      },
    };
    configureRateLimiter(sharedLimiter);

    await Promise.all([
      withJsonMutation(
        mutationRequest({ 'X-Forwarded-For': '198.51.100.10' }),
        schema,
        { rateLimitScope: 'spoofed-forwarding' },
        async () => Response.json({ data: {} }),
      ),
      withJsonMutation(
        mutationRequest({
          'X-Forwarded-For': '203.0.113.200',
          'X-247-Client-Address': '203.0.113.201',
        }),
        schema,
        { rateLimitScope: 'spoofed-forwarding' },
        async () => Response.json({ data: {} }),
      ),
    ]);

    expect(keys).toEqual([
      'spoofed-forwarding:untrusted-client',
      'spoofed-forwarding:untrusted-client',
    ]);
  });
});
