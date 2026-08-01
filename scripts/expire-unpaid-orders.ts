import { InventoryDisposition, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

import { expireUnpaidOrders } from '@/modules/commerce';
import { prisma } from '@/shared/db/client';

type Arguments = {
  actorId: string;
  before: Date;
  dryRun: boolean;
  limit: number;
  reason: string;
};

function parseArguments(values: string[]): Arguments {
  const parsed = new Map<string, string | true>();
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (key === '--dry-run') {
      if (parsed.has(key)) throw new Error('Duplicate --dry-run argument.');
      parsed.set(key, true);
      continue;
    }
    if (!['--actor-id', '--before', '--limit', '--reason'].includes(key))
      throw new Error(
        'Usage: pnpm orders:expire -- --actor-id <cuid> --before <ISO-8601> [--limit <1-100>] [--reason <text>] [--dry-run]',
      );
    const value = values[index + 1];
    if (!value || value.startsWith('--') || parsed.has(key))
      throw new Error(`Invalid ${key} argument.`);
    parsed.set(key, value);
    index += 1;
  }

  const actorId = parsed.get('--actor-id');
  const beforeValue = parsed.get('--before');
  if (
    typeof actorId !== 'string' ||
    !z.string().cuid().safeParse(actorId).success
  )
    throw new Error('--actor-id must be a valid user CUID.');
  if (typeof beforeValue !== 'string') throw new Error('--before is required.');
  const before = new Date(beforeValue);
  if (Number.isNaN(before.valueOf()))
    throw new Error('--before must be an ISO-8601 date/time.');

  const limitValue = parsed.get('--limit');
  const limit = typeof limitValue === 'string' ? Number(limitValue) : 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('--limit must be an integer from 1 to 100.');

  const reasonValue = parsed.get('--reason');
  const reason =
    typeof reasonValue === 'string'
      ? reasonValue.trim()
      : 'Expired by approved unpaid-order maintenance action.';
  if (reason.length < 3 || reason.length > 300)
    throw new Error('--reason must contain 3 to 300 characters.');

  return {
    actorId,
    before,
    dryRun: parsed.get('--dry-run') === true,
    limit,
    reason,
  };
}

async function loadOperator(actorId: string) {
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: {
      id: true,
      authVersion: true,
      isActive: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  });
  if (!user?.isActive) throw new Error('The supplied operator is not active.');
  const roles = user.roles.map(({ role }) => role.code);
  if (!roles.some((role) => role === 'MANAGER' || role === 'ADMIN'))
    throw new Error('The supplied operator must have MANAGER or ADMIN role.');
  return { userId: user.id, authVersion: user.authVersion, roles };
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  const actor = await loadOperator(input.actorId);
  if (input.dryRun) {
    const candidates = await prisma.order.count({
      where: {
        status: 'PENDING_CONFIRMATION',
        inventoryStatus: InventoryDisposition.RESERVED,
        createdAt: { lt: input.before },
        payment: {
          is: {
            status: { notIn: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
          },
        },
      },
    });
    process.stdout.write(
      `${JSON.stringify({
        orderExpiry: {
          dryRun: true,
          candidates: Math.min(candidates, input.limit),
          limit: input.limit,
        },
      })}\n`,
    );
    return;
  }

  const result = await expireUnpaidOrders(actor, input);
  process.stdout.write(`${JSON.stringify({ orderExpiry: result })}\n`);
  if (result.skipped > 0) process.exitCode = 2;
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Order expiry failed.'}\n`,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
