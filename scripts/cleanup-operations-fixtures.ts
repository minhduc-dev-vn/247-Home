import { cleanupOperationsFixtureNamespace } from '../tests/fixtures/operations';
import { prisma } from '@/shared/db/client';

const namespaces = process.argv.slice(2);

if (!namespaces.length) {
  throw new Error(
    'Usage: pnpm cleanup:operations-fixtures -- <ops-namespace> [<ops-namespace>...]',
  );
}

async function main() {
  try {
    for (const namespace of namespaces) {
      await cleanupOperationsFixtureNamespace(namespace, prisma);
      process.stdout.write(
        `Cleaned Operations fixture namespace ${namespace}.\n`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
