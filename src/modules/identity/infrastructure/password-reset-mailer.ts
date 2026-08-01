import { z } from 'zod';

import { sendLocalPasswordResetEmail } from '@/modules/identity/infrastructure/local-password-reset-mailer';

const resendEndpoint = 'https://api.resend.com/emails';
const deliveryTimeoutMs = 10_000;

const resendEnvironmentSchema = z.object({
  RESEND_API_KEY: z.string().trim().min(1).max(512),
  PASSWORD_RESET_FROM: z.string().trim().min(3).max(320),
});

export type PasswordResetEmail = {
  to: string;
  resetUrl: string;
  deliveryId: string;
};

export interface PasswordResetMailer {
  send(email: PasswordResetEmail): Promise<void>;
}

export class PasswordResetMailerError extends Error {
  constructor(
    public readonly code: 'MAILER_CONFIGURATION' | 'MAILER_DELIVERY_FAILED',
  ) {
    super(code);
    this.name = 'PasswordResetMailerError';
  }
}

function passwordResetMessage(resetUrl: string) {
  return {
    subject: 'Dat lai mat khau 247 Home',
    text: [
      'Ban da yeu cau dat lai mat khau tai khoan 247 Home.',
      'Mo lien ket sau de chon mat khau moi:',
      resetUrl,
      'Neu ban khong yeu cau, hay bo qua email nay.',
    ].join('\n\n'),
  };
}

function resendMailer(): PasswordResetMailer {
  const parsed = resendEnvironmentSchema.safeParse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    PASSWORD_RESET_FROM: process.env.PASSWORD_RESET_FROM,
  });
  if (!parsed.success)
    throw new PasswordResetMailerError('MAILER_CONFIGURATION');

  return {
    async send(email) {
      const message = passwordResetMessage(email.resetUrl);
      let response: Response;
      try {
        response = await fetch(resendEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${parsed.data.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `247-home-password-reset-${email.deliveryId}`,
            'User-Agent': '247-home-password-reset-worker/1.0',
          },
          body: JSON.stringify({
            from: parsed.data.PASSWORD_RESET_FROM,
            to: [email.to],
            subject: message.subject,
            text: message.text,
          }),
          redirect: 'error',
          signal: AbortSignal.timeout(deliveryTimeoutMs),
        });
      } catch {
        throw new PasswordResetMailerError('MAILER_DELIVERY_FAILED');
      }
      if (!response.ok)
        throw new PasswordResetMailerError('MAILER_DELIVERY_FAILED');
    },
  };
}

export function getPasswordResetMailer(): PasswordResetMailer {
  const mode =
    process.env.PASSWORD_RESET_MAILER ??
    (process.env.NODE_ENV === 'production' && process.env.LOCAL_DEMO !== 'true'
      ? 'resend'
      : 'local');

  if (mode === 'resend') return resendMailer();
  if (
    mode === 'local' &&
    (process.env.NODE_ENV !== 'production' || process.env.LOCAL_DEMO === 'true')
  ) {
    return { send: sendLocalPasswordResetEmail };
  }
  throw new PasswordResetMailerError('MAILER_CONFIGURATION');
}
