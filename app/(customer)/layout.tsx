import type { ReactNode } from 'react';

import { CustomerLayout } from '@/components/layout/customer-layout';
import { getCurrentActor } from '@/shared/auth/server';

export default async function CustomerRouteLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const actor = await getCurrentActor();
  return <CustomerLayout roles={actor?.roles}>{children}</CustomerLayout>;
}
