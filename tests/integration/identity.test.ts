import { createHash, randomUUID } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { POST as forgotPasswordPost } from '../../app/api/v1/auth/forgot-password/route';
import {
  authenticateWithPassword,
  getActiveActor,
  getOwnProfile,
  registerCustomer,
  resetPassword,
} from '@/modules/identity';
import { clearRateLimitsForTest } from '@/modules/identity/infrastructure/rate-limiter';
import { prisma } from '@/shared/db/client';

const createdEmails: string[] = [];
const outboxDirectory = path.join(process.cwd(), '.local-outbox');
let initialOutboxFiles = new Set<string>();

async function outboxFiles(): Promise<string[]> {
  try {
    return await readdir(outboxDirectory);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

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

describe('identity persistence and authorization', () => {
  beforeAll(async () => {
    initialOutboxFiles = new Set(await outboxFiles());
  });

  beforeEach(() => clearRateLimitsForTest());

  afterAll(async () => {
    const cleanupErrors: unknown[] = [];
    try {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    } catch (error: unknown) {
      cleanupErrors.push(error);
    }
    try {
      const createdOutboxFiles = (await outboxFiles()).filter(
        (filename) => !initialOutboxFiles.has(filename),
      );
      await Promise.all(
        createdOutboxFiles.map((filename) =>
          rm(path.join(outboxDirectory, filename), { force: true }),
        ),
      );
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
    const token =
      randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId: actor.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
      },
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
    const token =
      randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const passwords = ['ConcurrentPassword-A247', 'ConcurrentPassword-B247'];

    await prisma.passwordResetToken.create({
      data: {
        userId: actor.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

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

  it('does not distinguish reset requests for known and unknown email addresses', async () => {
    const { email } = await createCustomer();
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

    expect(knownResponse.status).toBe(200);
    expect(unknownResponse.status).toBe(200);
    await expect(knownResponse.json()).resolves.toMatchObject({
      data: { accepted: true },
    });
    await expect(unknownResponse.json()).resolves.toMatchObject({
      data: { accepted: true },
    });
  });
});
