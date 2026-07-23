import { describe, expect, it } from 'vitest';

import { parseServerEnvironment } from '@/shared/validation/env';

describe('parseServerEnvironment', () => {
  const validEnvironment = {
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5432/home247?schema=public',
    NEXTAUTH_SECRET: 'test-only-secret-that-is-at-least-32-characters',
    NEXTAUTH_URL: 'http://localhost:3000',
    TRUST_PROXY_HEADERS: 'false',
  };

  it('accepts the complete server security configuration', () => {
    expect(parseServerEnvironment(validEnvironment)).toEqual({
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5432/home247?schema=public',
      NEXTAUTH_SECRET: 'test-only-secret-that-is-at-least-32-characters',
      NEXTAUTH_URL: 'http://localhost:3000',
      TRUST_PROXY_HEADERS: 'false',
      RATE_LIMIT_BACKEND: 'memory',
      AUTH_SECURE_COOKIES: false,
    });
  });

  it('allows insecure cookies only for a production-like loopback demo', () => {
    const environment = parseServerEnvironment({
      ...validEnvironment,
      NEXTAUTH_URL: 'http://127.0.0.1:3000',
      APP_ORIGIN: 'http://127.0.0.1:3000',
      NODE_ENV: 'production',
      LOCAL_DEMO: 'true',
      AUTH_SECURE_COOKIES: 'false',
    });

    expect(environment.AUTH_SECURE_COOKIES).toBe(false);
  });

  it('rejects insecure cookies for a non-loopback production runtime', () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        NEXTAUTH_URL: 'https://demo.example.test',
        NODE_ENV: 'production',
        LOCAL_DEMO: 'true',
        AUTH_SECURE_COOKIES: 'false',
      }),
    ).toThrow('loopback local demo');
  });

  it('requires the CloudFront and WAF contract in production', () => {
    const production = {
      ...validEnvironment,
      NEXTAUTH_URL: 'https://247home.example',
      NODE_ENV: 'production',
    };
    expect(() => parseServerEnvironment(production)).toThrow(
      'CloudFront/WAF trusted ingress',
    );
    expect(
      parseServerEnvironment({
        ...production,
        TRUST_PROXY_HEADERS: 'true',
        TRUSTED_PROXY_PROVIDER: 'cloudfront',
        RATE_LIMIT_BACKEND: 'waf',
      }),
    ).toMatchObject({
      TRUST_PROXY_HEADERS: 'true',
      TRUSTED_PROXY_PROVIDER: 'cloudfront',
      RATE_LIMIT_BACKEND: 'waf',
      AUTH_SECURE_COOKIES: true,
    });
  });

  it('allows build-time page analysis without weakening runtime checks', () => {
    expect(
      parseServerEnvironment({
        ...validEnvironment,
        NEXTAUTH_URL: 'https://build.example.test',
        NODE_ENV: 'production',
        NEXT_PHASE: 'phase-production-build',
      }),
    ).toMatchObject({
      RATE_LIMIT_BACKEND: 'memory',
      AUTH_SECURE_COOKIES: true,
    });
  });

  it('rejects a missing database URL', () => {
    expect(() => parseServerEnvironment({})).toThrow();
  });

  it('rejects a short Auth.js secret or invalid application URL', () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        NEXTAUTH_SECRET: 'too-short',
      }),
    ).toThrow();
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        NEXTAUTH_URL: 'not-a-url',
      }),
    ).toThrow();
  });
});
