import { deliverPendingPasswordResetEmails } from '@/modules/identity';

function parseLimit(argumentsList: string[]): number | undefined {
  if (argumentsList.length === 0) return undefined;
  if (argumentsList.length !== 2 || argumentsList[0] !== '--limit') {
    throw new Error('Usage: pnpm password-reset:deliver -- --limit <1-100>');
  }
  const limit = Number(argumentsList[1]);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error(
      'The outbox delivery limit must be an integer from 1 to 100.',
    );
  }
  return limit;
}

async function main() {
  const result = await deliverPendingPasswordResetEmails({
    limit: parseLimit(process.argv.slice(2)),
  });
  process.stdout.write(
    `${JSON.stringify({ passwordResetDelivery: result })}\n`,
  );
  if (result.failed > 0) process.exitCode = 1;
}

main().catch(() => {
  process.stderr.write('Password reset outbox delivery failed.\n');
  process.exitCode = 1;
});
