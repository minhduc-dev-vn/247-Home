import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearRateLimitsForTest,
  configureRateLimiter,
  consumeRateLimit,
  type RateLimiter,
} from '@/modules/identity/infrastructure/rate-limiter';

describe('identity rate limiter', () => {
  afterEach(() => {
    clearRateLimitsForTest();
    vi.unstubAllEnvs();
  });

  it('blocks the sixth login attempt in the active window', () => {
    const now = 1_000;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        consumeRateLimit('login', 'customer@example.test', now).allowed,
      ).toBe(true);
    }

    const result = consumeRateLimit('login', 'customer@example.test', now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('delegates to a pluggable shared-store adapter', () => {
    const calls: Array<{ action: string; key: string; limit: number }> = [];
    const adapter: RateLimiter = {
      consume(action, key, policy) {
        calls.push({ action, key, limit: policy.limit });
        return { allowed: false, retryAfterSeconds: 9 };
      },
    };
    configureRateLimiter(adapter);

    expect(consumeRateLimit('sensitive-mutation', 'client')).toEqual({
      allowed: false,
      retryAfterSeconds: 9,
    });
    expect(calls).toEqual([
      { action: 'sensitive-mutation', key: 'client', limit: 30 },
    ]);
  });

  it('delegates production enforcement to the shared WAF edge', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'waf');
    expect(consumeRateLimit('login', 'replica-a')).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(consumeRateLimit('login', 'replica-b')).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('fails closed when production has no shared limiter', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.RATE_LIMIT_BACKEND;
    delete process.env.LOCAL_DEMO;
    expect(() => consumeRateLimit('login', 'client')).toThrow(
      'RATE_LIMIT_BACKEND=waf',
    );
  });
});
