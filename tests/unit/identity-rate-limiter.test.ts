import { afterEach, describe, expect, it } from 'vitest';

import {
  clearRateLimitsForTest,
  configureRateLimiter,
  consumeRateLimit,
  type RateLimiter,
} from '@/modules/identity/infrastructure/rate-limiter';

describe('identity rate limiter', () => {
  afterEach(() => clearRateLimitsForTest());

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
});
