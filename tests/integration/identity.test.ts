import { createHash, randomUUID } from 'node:crypto';

import { PasswordResetDeliveryStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { POST as forgotPasswordPost } from '../../app/api/v1/auth/forgot-password/route';
import { POST as registerPost } from '../../app/api/v1/auth/register/route';
import {
  authenticateWithPassword,
  deliverPasswordResetEmail,
  getActiveActor,
  getOwnProfile,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
} from '@/modules/identity';
import { clearRateLimitsForTest } from '@/modules/identity/infrastructure/rate-limiter';
import {
  decryptPasswordResetToken,
  encryptPasswordResetToken,
} from '@/modules/identity/infrastructure/password-reset-outbox-crypto';
import { type PasswordResetEmail } from '@/modules/identity/infrastructure/password-reset-mailer';
import { prisma } from '@/shared/db/client';

const createdEmails: string[] = [];

function nextEmail(): string {
  const email = `identity-${randomUUID()}@example.test`;
  createdEmails.push(email);
  return email;
}

async function createCustomer() {
  const email = nextEmail();
  const password = 'IntegrationPassword-247';
  const actor = await registerCustomer({
    name: 'Integration Customer',
    email,
    password,
  });
  return { actor, email, password };
}

async function createDeliveredResetToken(input: {
  userId: string;
  email: string;
}) {
  const token =
    randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: input.userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      delivery: {
        create: {
          recipientEmail: input.email,
          encryptedToken: encryptPasswordResetToken(token),
          status: PasswordResetDeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      },
    },
  });
  return { token, tokenHash };
}

describe('identity persistence and authorization', () => {
  beforeEach(() => clearRateLimitsForTest());

  afterAll(async () => {
    const cleanupErrors: unknown[] = [];
    try {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    } catch (error: unknown) {
      cleanupErrors.push(error);
    }
    try {
      await prisma.$disconnect();
    } catch (error: unknown) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length)
      throw new AggregateError(cleanupErrors, 'Identity test cleanup failed.');
  });

  it('creates a customer with a bcrypt hash and default CUSTOMER role', async () => {
    const { actor, email, password } = await createCustomer();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    expect(actor.roles).toEqual(['CUSTOMER']);
    expect(user.passwordHash).not.toBe(password);
    await expect(
      authenticateWithPassword({ email, password }),
    ).resolves.toEqual(actor);
  });

  it('creates and authenticates a customer through the registration HTTP contract', async () => {
    const email = nextEmail();
    const password = 'Http247!';
    const response = await registerPost(
      new Request('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          name: 'HTTP Registration Customer',
          email,
          password,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    await expect(response.json()).resolves.toMatchObject({
      data: { created: true },
    });
    await expect(
      authenticateWithPassword({ email, password }),
    ).resolves.toMatchObject({ roles: ['CUSTOMER'] });
  });

  it('returns the stable registration error for a duplicate email', async () => {
    const email = nextEmail();
    const body = JSON.stringify({
      name: 'Duplicate Registration Customer',
      email,
      password: 'Duplicate247!',
    });
    const headers = {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
    };

    const first = await registerPost(
      new Request('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers,
        body,
      }),
    );
    const duplicate = await registerPost(
      new Request('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers,
        body,
      }),
    );

    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(422);
    await expect(duplicate.json()).resolves.toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        requestId: expect.stringMatching(/^req_/),
      },
    });
  });

  it('rejects a cross-origin registration request before it creates a user', async () => {
    const email = nextEmail();
    const response = await registerPost(
      new Request('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example',
        },
        body: JSON.stringify({
          name: 'Origin Rejection Customer',
          email,
          password: 'Origin247!',
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(
      prisma.user.findUnique({ where: { email } }),
    ).resolves.toBeNull();
  });

  it('handles concurrent customer registrations without duplicating the system role', async () => {
    const emails = [nextEmail(), nextEmail()];
    const responses = await Promise.all(
      emails.map((email, index) =>
        registerPost(
          new Request('http://localhost:3000/api/v1/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Origin: 'http://localhost:3000',
              'x-forwarded-for': `198.51.100.${index + 10}`,
            },
            body: JSON.stringify({
              name: `Concurrent Customer ${index + 1}`,
              email,
              password: 'ConcurrentRegistrationPassword-247',
            }),
          }),
        ),
      ),
    );

    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    await expect(
      prisma.role.count({ where: { code: 'CUSTOMER' } }),
    ).resolves.toBe(1);
    await expect(
      prisma.user.count({ where: { email: { in: emails } } }),
    ).resolves.toBe(2);
  });

  it('does not return another customer profile', async () => {
    const first = await createCustomer();
    const second = await createCustomer();

    await expect(
      getOwnProfile(first.actor, first.actor.userId),
    ).resolves.toMatchObject({ id: first.actor.userId });
    await expect(
      getOwnProfile(first.actor, second.actor.userId),
    ).resolves.toBeNull();
  });

  it('expires all reset tokens and invalidates the previous password session version', async () => {
    const { actor, email, password } = await createCustomer();
    const { token, tokenHash } = await createDeliveredResetToken({
      userId: actor.userId,
      email,
    });
    await resetPassword({ token, password: 'ReplacementPassword-247' });

    await expect(
      authenticateWithPassword({ email, password }),
    ).resolves.toBeNull();
    await expect(
      authenticateWithPassword({ email, password: 'ReplacementPassword-247' }),
    ).resolves.toMatchObject({ userId: actor.userId });
    await expect(
      getActiveActor(actor.userId, actor.authVersion),
    ).resolves.toBeNull();
    await expect(
      prisma.passwordResetToken.findUniqueOrThrow({ where: { tokenHash } }),
    ).resolves.toMatchObject({ usedAt: expect.any(Date) });
  });

  it('allows a password reset token to be claimed exactly once under concurrency', async () => {
    const { actor, email } = await createCustomer();
    const { token, tokenHash } = await createDeliveredResetToken({
      userId: actor.userId,
      email,
    });
    const passwords = ['ConcurrentPassword-A247', 'ConcurrentPassword-B247'];

    const results = await Promise.allSettled(
      passwords.map((password) => resetPassword({ token, password })),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected?.reason).toMatchObject({ code: 'INVALID_RESET_TOKEN' });

    const authentications = await Promise.all(
      passwords.map((password) =>
        authenticateWithPassword({ email, password }),
      ),
    );
    expect(authentications.filter(Boolean)).toHaveLength(1);
    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: actor.userId } }),
    ).resolves.toMatchObject({ authVersion: actor.authVersion + 1 });
    await expect(
      prisma.passwordResetToken.count({
        where: { tokenHash, usedAt: null },
      }),
    ).resolves.toBe(0);
  });

  it('keeps a reset token unusable until the durable delivery succeeds', async () => {
    const { actor, email } = await createCustomer();
    await requestPasswordReset(email);
    const delivery = await prisma.passwordResetDelivery.findFirstOrThrow({
      where: { passwordResetToken: { is: { userId: actor.userId } } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        encryptedToken: true,
        passwordResetToken: { select: { tokenHash: true } },
      },
    });
    const sent: PasswordResetEmail[] = [];
    const queuedToken = decryptPasswordResetToken(delivery.encryptedToken);

    expect(delivery.encryptedToken).not.toContain(queuedToken);
    await expect(
      resetPassword({
        token: queuedToken,
        password: 'BeforeDelivery247!',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    await expect(
      deliverPasswordResetEmail(delivery.id, {
        mailer: { send: async (message) => void sent.push(message) },
      }),
    ).resolves.toBe('delivered');

    expect(sent).toHaveLength(1);
    const token = new URL(sent[0].resetUrl).searchParams.get('token');
    expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    await expect(
      resetPassword({ token: token ?? '', password: 'AfterDelivery247!' }),
    ).resolves.toBeUndefined();
    await expect(
      prisma.passwordResetDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      }),
    ).resolves.toMatchObject({
      status: PasswordResetDeliveryStatus.DELIVERED,
      deliveredAt: expect.any(Date),
    });
  });

  it('claims a queued reset delivery exactly once under concurrency', async () => {
    const { actor, email } = await createCustomer();
    await requestPasswordReset(email);
    const delivery = await prisma.passwordResetDelivery.findFirstOrThrow({
      where: { passwordResetToken: { is: { userId: actor.userId } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const sent: PasswordResetEmail[] = [];
    const mailer = {
      send: async (message: PasswordResetEmail) => void sent.push(message),
    };

    const outcomes = await Promise.all([
      deliverPasswordResetEmail(delivery.id, { mailer }),
      deliverPasswordResetEmail(delivery.id, { mailer }),
    ]);

    expect(outcomes.sort()).toEqual(['delivered', 'skipped']);
    expect(sent).toHaveLength(1);
    await expect(
      prisma.passwordResetDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      }),
    ).resolves.toMatchObject({
      status: PasswordResetDeliveryStatus.DELIVERED,
      attempts: 1,
    });
  });

  it('keeps a token unusable after the mail provider rejects delivery', async () => {
    const { actor, email } = await createCustomer();
    await requestPasswordReset(email);
    const delivery = await prisma.passwordResetDelivery.findFirstOrThrow({
      where: { passwordResetToken: { is: { userId: actor.userId } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, encryptedToken: true, passwordResetTokenId: true },
    });
    const queuedToken = decryptPasswordResetToken(delivery.encryptedToken);

    await expect(
      deliverPasswordResetEmail(delivery.id, {
        mailer: {
          send: async () => {
            throw new Error('provider unavailable');
          },
        },
      }),
    ).resolves.toBe('failed');
    await expect(
      prisma.passwordResetDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      }),
    ).resolves.toMatchObject({
      status: PasswordResetDeliveryStatus.FAILED,
      lastFailureCode: 'MAILER_DELIVERY_FAILED',
    });
    await expect(
      resetPassword({
        token: queuedToken,
        password: 'FailedDelivery247!',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    await expect(
      prisma.passwordResetToken.findUniqueOrThrow({
        where: { id: delivery.passwordResetTokenId },
      }),
    ).resolves.toMatchObject({ usedAt: null });
  });

  it('does not distinguish reset requests for known and unknown email addresses', async () => {
    const { actor, email } = await createCustomer();
    const unknownEmail = nextEmail();

    const knownResponse = await forgotPasswordPost(
      new Request('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ email }),
      }),
    );
    const unknownResponse = await forgotPasswordPost(
      new Request('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ email: unknownEmail }),
      }),
    );

    expect(knownResponse.status).toBe(202);
    expect(unknownResponse.status).toBe(202);
    await expect(knownResponse.json()).resolves.toMatchObject({
      data: { accepted: true },
    });
    await expect(unknownResponse.json()).resolves.toMatchObject({
      data: { accepted: true },
    });
    await expect(
      prisma.passwordResetDelivery.count({
        where: { passwordResetToken: { is: { userId: actor.userId } } },
      }),
    ).resolves.toBe(1);
  });
});
