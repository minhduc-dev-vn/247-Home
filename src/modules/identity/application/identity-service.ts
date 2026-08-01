import { createHash, randomBytes } from 'node:crypto';

import { PasswordResetDeliveryStatus, Prisma } from '@prisma/client';

import { IdentityError } from '@/modules/identity/domain/errors';
import { type IdentityActor } from '@/modules/identity/domain/roles';
import {
  hashPassword,
  verifyPassword,
} from '@/modules/identity/infrastructure/password-hasher';
import {
  createCustomer,
  findPasswordResetUserByEmail,
  findUserByEmail,
  findUserById,
  type UserWithRoles,
} from '@/modules/identity/infrastructure/user-repository';
import { encryptPasswordResetToken } from '@/modules/identity/infrastructure/password-reset-outbox-crypto';
import {
  type LoginInput,
  normalizeEmail,
  type RegistrationInput,
  type ResetPasswordInput,
} from '@/modules/identity/presentation/schemas';
import { prisma } from '@/shared/db/client';

const passwordResetLifetimeMs = 60 * 60 * 1_000;
const passwordResetTimingPassword = 'password-reset-timing-padding-v1';
const passwordResetTimingHash =
  '$2b$12$DBUle2zaTvc3QObuxzRYeOjV3ph/v3BY1PowqetVinsGc.dwAKM/u';

function toActor(user: UserWithRoles): IdentityActor {
  return {
    userId: user.id,
    authVersion: user.authVersion,
    roles: user.roles.map(({ role }) => role.code),
  };
}

export async function registerCustomer(
  input: RegistrationInput,
): Promise<IdentityActor> {
  try {
    const user = await createCustomer({
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      passwordHash: await hashPassword(input.password),
    });
    return toActor(user);
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new IdentityError('EMAIL_UNAVAILABLE');
    }
    throw error;
  }
}

export async function authenticateWithPassword(
  input: LoginInput,
): Promise<IdentityActor | null> {
  const user = await findUserByEmail(normalizeEmail(input.email));

  if (!user || !user.isActive) {
    return null;
  }

  const isPasswordValid = await verifyPassword(
    input.password,
    user.passwordHash,
  );
  return isPasswordValid ? toActor(user) : null;
}

export async function getActiveActor(
  userId: string,
  sessionAuthVersion: number,
): Promise<IdentityActor | null> {
  const user = await findUserById(userId);

  if (!user || !user.isActive || user.authVersion !== sessionAuthVersion) {
    return null;
  }

  return toActor(user);
}

export async function getOwnProfile(actor: IdentityActor, userId: string) {
  if (actor.userId !== userId) {
    return null;
  }

  const user = await findUserById(userId);
  if (!user || !user.isActive) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map(({ role }) => role.code),
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const [user] = await Promise.all([
    findPasswordResetUserByEmail(normalizeEmail(email)),
    verifyPassword(passwordResetTimingPassword, passwordResetTimingHash),
  ]);

  if (!user || !user.isActive) {
    return;
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + passwordResetLifetimeMs);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    await transaction.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        delivery: {
          create: {
            recipientEmail: user.email,
            encryptedToken: encryptPasswordResetToken(token),
          },
        },
      },
    });
  });
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = createHash('sha256').update(input.token).digest('hex');
  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (transaction) => {
    const now = new Date();
    const resetToken = await transaction.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        userId: true,
        delivery: { select: { status: true } },
      },
    });

    if (
      !resetToken ||
      resetToken.delivery?.status !== PasswordResetDeliveryStatus.DELIVERED
    ) {
      throw new IdentityError('INVALID_RESET_TOKEN');
    }

    const claimed = await transaction.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      throw new IdentityError('INVALID_RESET_TOKEN');
    }

    await transaction.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, authVersion: { increment: 1 } },
    });
    await transaction.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: now },
    });
  });
}
