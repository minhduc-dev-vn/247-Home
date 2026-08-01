import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearRateLimitsForTest } from '@/modules/identity/infrastructure/rate-limiter';
import {
  configureStructuredLogger,
  resetStructuredLoggerForTest,
  type StructuredLogger,
} from '@/shared/observability/logger';

const requestPasswordReset = vi.hoisted(() => vi.fn());
const resetPassword = vi.hoisted(() => vi.fn());

vi.mock('@/modules/identity', async () => {
  const { z } = await import('zod');
  class IdentityError extends Error {
    constructor(public readonly code: 'INVALID_RESET_TOKEN') {
      super(code);
    }
  }

  return {
    forgotPasswordSchema: z.object({ email: z.string().email() }).strict(),
    resetPasswordSchema: z
      .object({ token: z.string().min(32), password: z.string().min(8) })
      .strict(),
    IdentityError,
    requestPasswordReset,
    resetPassword,
  };
});

import { POST as forgotPasswordPost } from '../../app/api/v1/auth/forgot-password/route';
import { POST as resetPasswordPost } from '../../app/api/v1/auth/reset-password/route';

function captureErrorLogs() {
  const error = vi.fn<StructuredLogger['error']>();
  configureStructuredLogger({
    info: vi.fn<StructuredLogger['info']>(),
    warn: vi.fn<StructuredLogger['warn']>(),
    error,
  });
  return error;
}

describe('password reset route error contracts', () => {
  afterEach(() => {
    vi.clearAllMocks();
    clearRateLimitsForTest();
    resetStructuredLoggerForTest();
  });

  it('returns the same accepted response when reset request persistence fails', async () => {
    const logs = captureErrorLogs();
    requestPasswordReset.mockRejectedValueOnce(
      new Error('database connection interrupted'),
    );

    const response = await forgotPasswordPost(
      new Request('http://localhost:3000/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ email: 'customer@example.test' }),
      }),
    );

    expect(response.status).toBe(202);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await response.json();
    expect(body).toMatchObject({ data: { accepted: true } });
    expect(JSON.stringify(body)).not.toContain(
      'database connection interrupted',
    );
    expect(logs).toHaveBeenCalledWith(
      'application.error',
      expect.objectContaining({
        route: '/api/v1/auth/forgot-password',
        category: 'password-reset-request',
        errorCode: 'Error',
      }),
    );
    expect(JSON.stringify(logs.mock.calls)).not.toContain(
      'database connection interrupted',
    );
  });

  it('logs an unexpected reset completion failure without logging the token', async () => {
    const logs = captureErrorLogs();
    const token = 'a'.repeat(43);
    resetPassword.mockRejectedValueOnce(
      new Error(`unexpected failure for ${token}`),
    );

    const response = await resetPasswordPost(
      new Request('http://localhost:3000/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ token, password: 'Replacement247!' }),
      }),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain(token);
    expect(logs).toHaveBeenCalledWith(
      'application.error',
      expect.objectContaining({
        route: '/api/v1/auth/reset-password',
        category: 'password-reset-completion',
        errorCode: 'Error',
      }),
    );
    expect(JSON.stringify(logs.mock.calls)).not.toContain(token);
  });
});
