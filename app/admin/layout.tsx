import type { ReactNode } from 'react';

import { AdminLayout } from '@/components/layout/admin-layout';
import { requirePageRole } from '@/shared/auth/server';

export default async function AdminRouteLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const actor = await requirePageRole('STAFF', 'MANAGER', 'ADMIN');
  return <AdminLayout roles={actor.roles}>{children}</AdminLayout>;
}
