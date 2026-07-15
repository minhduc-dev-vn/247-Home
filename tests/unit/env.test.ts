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
