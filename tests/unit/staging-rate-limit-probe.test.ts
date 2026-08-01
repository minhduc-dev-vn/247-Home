import { describe, expect, it, vi } from 'vitest';

import {
  parseRateLimitProbeConfig,
  runRateLimitProbe,
} from '../../scripts/verify-staging-rate-limit';

describe('staging rate-limit probe', () => {
  it('uses an HTTPS bounded probe with deliberately spoofed headers', async () => {
    const config = parseRateLimitProbeConfig({
      STAGING_BASE_URL: 'https://staging.example.test',
      RATE_LIMIT_PROBE_REQUESTS: '12',
      RATE_LIMIT_PROBE_MIN_429_AT: '10',
    });
    const calls: Array<{ url: URL; init: RequestInit | undefined }> = [];
    const fetchImplementation: typeof fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: input as URL, init });
        const status = calls.length === 10 ? 429 : 400;
        return new Response(null, {
          status,
          headers: status === 429 ? { 'Retry-After': '300' } : undefined,
        });
      },
    );

    await expect(
      runRateLimitProbe(config, fetchImplementation),
    ).resolves.toEqual({
      check: 'staging-shared-rate-limit',
      scope: 'auth',
      authEndpoint: 'forgot-password',
      requestsSent: 10,
      limitedAt: 10,
      retryAfterSeconds: '300',
      statusCounts: { 400: 9, 429: 1 },
      spoofedForwardingHeadersSent: true,
      directOrigin: 'not-checked',
      status: 'PASS',
    });
    expect(calls).toHaveLength(10);
    expect(calls[0]?.url.pathname).toBe('/api/v1/auth/forgot-password');
    const firstHeaders = new Headers(calls[0]?.init?.headers);
    const secondHeaders = new Headers(calls[1]?.init?.headers);
    expect(firstHeaders.get('Origin')).toBe('https://staging.example.test');
    expect(firstHeaders.get('X-247-Client-Address')).toBe('203.0.113.2');
    expect(firstHeaders.get('X-Forwarded-For')).toBe(
      '203.0.113.2, 198.51.100.1',
    );
    expect(secondHeaders.get('X-247-Client-Address')).toBe('203.0.113.3');
  });

  it('fails rather than accepting a process-local 429 before the edge threshold', async () => {
    const config = parseRateLimitProbeConfig({
      STAGING_BASE_URL: 'https://staging.example.test',
      RATE_LIMIT_PROBE_REQUESTS: '12',
      RATE_LIMIT_PROBE_MIN_429_AT: '10',
    });
    const fetchImplementation: typeof fetch = vi.fn(
      async () =>
        new Response(null, { status: 429, headers: { 'Retry-After': '60' } }),
    );

    await expect(
      runRateLimitProbe(config, fetchImplementation),
    ).rejects.toThrow('before the configured minimum 10');
  });

  it('selects non-mutating probes for every WAF-covered endpoint class', async () => {
    const login = parseRateLimitProbeConfig({
      STAGING_BASE_URL: 'https://staging.example.test',
      RATE_LIMIT_PROBE_AUTH_ENDPOINT: 'login',
    });
    const registration = parseRateLimitProbeConfig({
      STAGING_BASE_URL: 'https://staging.example.test',
      RATE_LIMIT_PROBE_AUTH_ENDPOINT: 'register',
    });
    const mutation = parseRateLimitProbeConfig({
      STAGING_BASE_URL: 'https://staging.example.test',
      RATE_LIMIT_PROBE_SCOPE: 'mutation',
    });

    expect(login.authEndpoint).toBe('login');
    expect(registration.authEndpoint).toBe('register');
    expect(mutation.scope).toBe('mutation');
  });

  it('rejects a direct-origin target that is the public URL', () => {
    expect(() =>
      parseRateLimitProbeConfig({
        STAGING_BASE_URL: 'https://staging.example.test',
        STAGING_ORIGIN_URL: 'https://staging.example.test',
      }),
    ).toThrow('must not be the public staging origin');
  });
});
