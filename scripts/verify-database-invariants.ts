import { prisma } from '@/shared/db/client';

type CountResult = { count: bigint };

async function count(sql: TemplateStringsArray): Promise<number> {
  const [result] = await prisma.$queryRaw<CountResult[]>(sql);
  return Number(result?.count ?? 0n);
}

async function main() {
  const checks = {
    unfinishedMigrations: await count`
      SELECT COUNT(*)::bigint AS count
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `,
    unvalidatedConstraints: await count`
      SELECT COUNT(*)::bigint AS count
      FROM pg_constraint
      WHERE NOT convalidated
        AND connamespace = 'public'::regnamespace
    `,
    invalidInventory: await count`
      SELECT COUNT(*)::bigint AS count
      FROM inventory
      WHERE on_hand < 0 OR reserved < 0 OR reserved > on_hand
    `,
    invalidAllocations: await count`
      SELECT COUNT(*)::bigint AS count
      FROM inventory_allocations
      WHERE quantity <= 0
         OR (status = 'CONSUMED' AND consumed_at IS NULL)
         OR (status = 'RELEASED' AND released_at IS NULL)
    `,
    invalidSlotCapacity: await count`
      SELECT COUNT(*)::bigint AS count
      FROM installation_slots
      WHERE capacity < 0 OR booked_count < 0 OR booked_count > capacity
    `,
  };

  const failed = Object.entries(checks).filter(([, value]) => value !== 0);
  console.log(
    JSON.stringify({
      check: 'database-invariants',
      checks,
      status: failed.length === 0 ? 'PASS' : 'FAIL',
    }),
  );
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Invariant failure');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
