import { PrismaClient } from '@prisma/client';

import { getServerEnvironment } from '@/shared/validation/env';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: getServerEnvironment().DATABASE_URL } },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
