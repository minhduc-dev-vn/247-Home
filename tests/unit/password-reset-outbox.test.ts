import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decryptPasswordResetToken,
  encryptPasswordResetToken,
  PasswordResetOutboxCryptoError,
} from '@/modules/identity/infrastructure/password-reset-outbox-crypto';
import {
  getPasswordResetMailer,
  PasswordResetMailerError,
} from '@/modules/identity/infrastructure/password-reset-mailer';

describe('password reset outbox security', () => {
  beforeEach(() => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://postgres:postgres@localhost:5432/home247?schema=public',
    );
    vi.stubEnv('NEXTAUTH_SECRET', 'test-only-password-reset-outbox-secret-247');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('encrypts reset tokens before durable persistence and rejects tampering', () => {
    const token = 'test-reset-token-with-enough-entropy-247-home';
    const encrypted = encryptPasswordResetToken(token);

    expect(encrypted).not.toContain(token);
    expect(decryptPasswordResetToken(encrypted)).toBe(token);
    const tampered = `${encrypted.slice(0, -1)}${
      encrypted.endsWith('A') ? 'B' : 'A'
    }`;
    expect(() => decryptPasswordResetToken(tampered)).toThrow(
      PasswordResetOutboxCryptoError,
    );
  });

  it('does not select the local filesystem mailer in a production runtime', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOCAL_DEMO', 'false');
    vi.stubEnv('PASSWORD_RESET_MAILER', 'local');

    expect(() => getPasswordResetMailer()).toThrow(PasswordResetMailerError);
  });

  it('requires explicit Resend configuration when the production worker runs', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOCAL_DEMO', 'false');
    vi.stubEnv('PASSWORD_RESET_MAILER', 'resend');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('PASSWORD_RESET_FROM', '');

    expect(() => getPasswordResetMailer()).toThrow(PasswordResetMailerError);
  });
});
