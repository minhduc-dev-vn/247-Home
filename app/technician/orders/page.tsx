import { TechnicianOrdersList } from '@/components/operations/technician-console';
import { requirePageRole } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

export default async function TechnicianOrdersPage() {
  await requirePageRole('TECHNICIAN');
  return <TechnicianOrdersList />;
}
