import { type Prisma, RoleCode } from '@prisma/client';

import { prisma } from '@/shared/db/client';

const userWithRoles = {
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

export type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof userWithRoles;
}>;

export function findUserByEmail(email: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({ where: { email }, include: userWithRoles });
}

export function findUserById(id: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({ where: { id }, include: userWithRoles });
}

export function findRoleByCode(code: RoleCode) {
  return prisma.role.findUnique({ where: { code } });
}

export function createCustomer(input: {
  name: string;
  email: string;
  passwordHash: string;
  customerRoleId: string;
}) {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      roles: { create: { roleId: input.customerRoleId } },
    },
    include: userWithRoles,
  });
}
