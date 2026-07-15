import { createHash, randomBytes } from 'node:crypto';

import { Prisma, RoleCode } from '@prisma/client';

import { IdentityError } from '@/modules/identity/domain/errors';
import { type IdentityActor } from '@/modules/identity/domain/roles';
import {
  hashPassword,
  verifyPassword,
} from '@/modules/identity/infrastructure/password-hasher';
import {
  createCustomer,
  findRoleByCode,
  findUserByEmail,
  findUserById,
  type UserWithRoles,
} from '@/modules/identity/infrastructure/user-repository';
import { sendLocalPasswordResetEmail } from '@/modules/identity/infrastructure/local-password-reset-mailer';
import {
  type LoginInput,
  normalizeEmail,
  type RegistrationInput,
  type ResetPasswordInput,
} from '@/modules/identity/presentation/schemas';
import { prisma } from '@/shared/db/client';

const passwordResetLifetimeMs = 60 * 60 * 1_000;

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
  const customerRole = await findRoleByCode(RoleCode.CUSTOMER);

  if (!customerRole) {
    throw new IdentityError('IDENTITY_CONFIGURATION_ERROR');
  }

  try {
    const user = await createCustomer({
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      passwordHash: await hashPassword(input.password),
      customerRoleId: customerRole.id,
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
  const user = await findUserByEmail(normalizeEmail(email));

  if (!user || !user.isActive) {
    return;
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + passwordResetLifetimeMs);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  await sendLocalPasswordResetEmail({
    to: user.email,
    resetUrl: `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`,
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
      select: { id: true, userId: true },
    });

    if (!resetToken) {
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
