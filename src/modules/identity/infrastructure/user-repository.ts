import { type Prisma, type PrismaClient, RoleCode } from '@prisma/client';

import { prisma } from '@/shared/db/client';

const userWithRoles = {
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

export type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof userWithRoles;
}>;

type IdentityDatabaseClient = Pick<PrismaClient, '$transaction'>;

export function findUserByEmail(email: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({ where: { email }, include: userWithRoles });
}

export function findUserById(id: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({ where: { id }, include: userWithRoles });
}

export function findPasswordResetUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true },
  });
}

export function createCustomer(
  input: {
    name: string;
    email: string;
    passwordHash: string;
  },
  database: IdentityDatabaseClient = prisma,
) {
  return database.$transaction(async (transaction) => {
    const customerRole = await transaction.role.upsert({
      where: { code: RoleCode.CUSTOMER },
      create: { code: RoleCode.CUSTOMER },
      update: {},
      select: { id: true },
    });

    return transaction.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        roles: { create: { roleId: customerRole.id } },
      },
      include: userWithRoles,
    });
  });
}
