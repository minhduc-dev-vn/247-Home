import { redirect } from 'next/navigation';

import { requirePageRole } from '@/shared/auth/server';
export const dynamic = 'force-dynamic';
export default async function TechnicianPage() {
  await requirePageRole('TECHNICIAN');
  redirect('/technician/orders');
}
