import { randomUUID } from 'node:crypto';

import { PasswordResetDeliveryStatus } from '@prisma/client';

import {
  decryptPasswordResetToken,
  PasswordResetOutboxCryptoError,
} from '@/modules/identity/infrastructure/password-reset-outbox-crypto';
import {
  getPasswordResetMailer,
  PasswordResetMailerError,
  type PasswordResetMailer,
} from '@/modules/identity/infrastructure/password-reset-mailer';
import { prisma } from '@/shared/db/client';
import { getServerEnvironment } from '@/shared/validation/env';
import { logApplicationError } from '@/shared/observability/logger';

const processingLeaseMs = 2 * 60 * 1_000;
const maximumDeliveryAttempts = 5;
const maximumDeliveryBatchSize = 100;
const retryDelaysMs = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export type PasswordResetDeliveryOutcome = 'delivered' | 'failed' | 'skipped';

type DeliveryOptions = {
  mailer?: PasswordResetMailer;
  now?: Date;
};

type BatchDeliveryOptions = DeliveryOptions & { limit?: number };

type ClaimedDelivery = {
  id: string;
  attempts: number;
  processingToken: string | null;
  recipientEmail: string;
  encryptedToken: string;
  passwordResetToken: { id: string; expiresAt: Date; usedAt: Date | null };
};

function boundedBatchSize(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(
    Math.max(Math.trunc(limit ?? 20), 1),
    maximumDeliveryBatchSize,
  );
}

function retryAt(now: Date, attempts: number): Date {
  const delay = retryDelaysMs[Math.min(attempts - 1, retryDelaysMs.length - 1)];
  return new Date(now.getTime() + delay);
}

function failureCode(error: unknown): string {
  if (error instanceof PasswordResetOutboxCryptoError)
    return 'OUTBOX_TOKEN_UNAVAILABLE';
  if (error instanceof PasswordResetMailerError) return error.code;
  return 'MAILER_DELIVERY_FAILED';
}

function resetUrl(token: string): string {
  const url = new URL('/reset-password', getServerEnvironment().NEXTAUTH_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

function activeDeliveryWhere(now: Date) {
  return {
    passwordResetToken: {
      is: {
        usedAt: null,
        expiresAt: { gt: now },
      },
    },
  };
}

function claimableDeliveryWhere(now: Date) {
  return {
    ...activeDeliveryWhere(now),
    OR: [
      {
        status: {
          in: [
            PasswordResetDeliveryStatus.PENDING,
            PasswordResetDeliveryStatus.FAILED,
          ],
        },
        nextAttemptAt: { lte: now },
      },
      {
        status: PasswordResetDeliveryStatus.PROCESSING,
        processingLeaseExpiresAt: { lte: now },
      },
    ],
  };
}

async function claimDelivery(
  id: string,
  now: Date,
): Promise<ClaimedDelivery | null> {
  const processingToken = randomUUID();
  const processingLeaseExpiresAt = new Date(now.getTime() + processingLeaseMs);
  const claimed = await prisma.passwordResetDelivery.updateMany({
    where: { id, ...claimableDeliveryWhere(now) },
    data: {
      status: PasswordResetDeliveryStatus.PROCESSING,
      attempts: { increment: 1 },
      processingToken,
      processingLeaseExpiresAt,
      lastFailureCode: null,
    },
  });
  if (claimed.count !== 1) return null;

  return prisma.passwordResetDelivery.findUnique({
    where: { id },
    select: {
      id: true,
      attempts: true,
      processingToken: true,
      recipientEmail: true,
      encryptedToken: true,
      passwordResetToken: {
        select: { id: true, expiresAt: true, usedAt: true },
      },
    },
  });
}

async function recordDeliveryFailure(
  delivery: ClaimedDelivery,
  now: Date,
  code: string,
): Promise<void> {
  const isFinalAttempt = delivery.attempts >= maximumDeliveryAttempts;
  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.passwordResetDelivery.updateMany({
      where: {
        id: delivery.id,
        status: PasswordResetDeliveryStatus.PROCESSING,
        processingToken: delivery.processingToken,
      },
      data: isFinalAttempt
        ? {
            status: PasswordResetDeliveryStatus.CANCELLED,
            processingToken: null,
            processingLeaseExpiresAt: null,
            lastFailureCode: code,
          }
        : {
            status: PasswordResetDeliveryStatus.FAILED,
            processingToken: null,
            processingLeaseExpiresAt: null,
            nextAttemptAt: retryAt(now, delivery.attempts),
            lastFailureCode: code,
          },
    });
    if (isFinalAttempt && updated.count === 1) {
      await transaction.passwordResetToken.updateMany({
        where: { id: delivery.passwordResetToken.id, usedAt: null },
        data: { usedAt: now },
      });
    }
  });
  logApplicationError({
    requestId: `outbox_${delivery.id}`,
    route: 'password-reset-delivery-worker',
    category: 'password-reset-delivery',
    errorCode: code,
  });
}

async function markDeliveryDelivered(
  delivery: ClaimedDelivery,
  now: Date,
): Promise<boolean> {
  const marked = await prisma.passwordResetDelivery.updateMany({
    where: {
      id: delivery.id,
      status: PasswordResetDeliveryStatus.PROCESSING,
      processingToken: delivery.processingToken,
      ...activeDeliveryWhere(now),
    },
    data: {
      status: PasswordResetDeliveryStatus.DELIVERED,
      processingToken: null,
      processingLeaseExpiresAt: null,
      deliveredAt: now,
      lastFailureCode: null,
    },
  });
  return marked.count === 1;
}

export async function deliverPasswordResetEmail(
  deliveryId: string,
  options: DeliveryOptions = {},
): Promise<PasswordResetDeliveryOutcome> {
  const now = options.now ?? new Date();
  const delivery = await claimDelivery(deliveryId, now);
  if (
    !delivery ||
    delivery.passwordResetToken.usedAt ||
    delivery.passwordResetToken.expiresAt <= now
  )
    return 'skipped';

  try {
    const token = decryptPasswordResetToken(delivery.encryptedToken);
    const mailer = options.mailer ?? getPasswordResetMailer();
    await mailer.send({
      to: delivery.recipientEmail,
      resetUrl: resetUrl(token),
      deliveryId: delivery.id,
    });
    return (await markDeliveryDelivered(delivery, now))
      ? 'delivered'
      : 'skipped';
  } catch (error: unknown) {
    await recordDeliveryFailure(delivery, now, failureCode(error));
    return 'failed';
  }
}

export async function deliverPendingPasswordResetEmails(
  options: BatchDeliveryOptions = {},
): Promise<Record<PasswordResetDeliveryOutcome, number>> {
  const now = options.now ?? new Date();
  const deliveries = await prisma.passwordResetDelivery.findMany({
    where: claimableDeliveryWhere(now),
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
    take: boundedBatchSize(options.limit),
  });
  const result: Record<PasswordResetDeliveryOutcome, number> = {
    delivered: 0,
    failed: 0,
    skipped: 0,
  };

  for (const delivery of deliveries) {
    const outcome = await deliverPasswordResetEmail(delivery.id, {
      mailer: options.mailer,
      now,
    });
    result[outcome] += 1;
  }
  return result;
}
