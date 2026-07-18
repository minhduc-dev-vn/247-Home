import type { ReactNode } from 'react';

import { TechnicianLayout } from '@/components/layout/technician-layout';
import { requirePageRole } from '@/shared/auth/server';

export default async function TechnicianRouteLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requirePageRole('TECHNICIAN');
  return <TechnicianLayout>{children}</TechnicianLayout>;
}
