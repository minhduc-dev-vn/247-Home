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
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true');
    vi.stubEnv('TRUSTED_PROXY_PROVIDER', 'cloudfront');
    expect(consumeRateLimit('login', 'replica-a')).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(consumeRateLimit('login', 'replica-b')).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('permits the explicitly declared single-instance Render staging limiter', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RENDER', 'true');
    vi.stubEnv('DEPLOYMENT_ENV', 'staging');
    vi.stubEnv('RENDER_STAGING_SINGLE_INSTANCE', 'true');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
    vi.stubEnv('TRUST_PROXY_HEADERS', 'false');

    expect(consumeRateLimit('register', '203.0.113.99')).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('treats an exact empty Render proxy provider as unset', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RENDER', 'true');
    vi.stubEnv('DEPLOYMENT_ENV', 'staging');
    vi.stubEnv('RENDER_STAGING_SINGLE_INSTANCE', 'true');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
    vi.stubEnv('TRUST_PROXY_HEADERS', 'false');
    vi.stubEnv('TRUSTED_PROXY_PROVIDER', '');

    expect(consumeRateLimit('register', '203.0.113.100')).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('rejects a non-empty Render proxy provider for the memory limiter', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RENDER', 'true');
    vi.stubEnv('DEPLOYMENT_ENV', 'staging');
    vi.stubEnv('RENDER_STAGING_SINGLE_INSTANCE', 'true');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
    vi.stubEnv('TRUST_PROXY_HEADERS', 'false');
    vi.stubEnv('TRUSTED_PROXY_PROVIDER', ' ');

    expect(() => consumeRateLimit('register', '203.0.113.101')).toThrow(
      'RATE_LIMIT_BACKEND=waf',
    );
  });

  it('fails closed when production has no shared limiter', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.RATE_LIMIT_BACKEND;
    delete process.env.LOCAL_DEMO;
    expect(() => consumeRateLimit('login', 'client')).toThrow(
      'RATE_LIMIT_BACKEND=waf',
    );
  });

  it('fails closed when the WAF backend is detached from CloudFront ingress', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'waf');
    vi.stubEnv('TRUST_PROXY_HEADERS', 'false');
    delete process.env.TRUSTED_PROXY_PROVIDER;

    expect(() => consumeRateLimit('login', 'client')).toThrow(
      'CloudFront trusted ingress contract',
    );
  });
});
