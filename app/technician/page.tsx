import { TechnicianConsole } from '@/components/operations/technician-console';
import { requirePageRole } from '@/shared/auth/server';
export const dynamic = 'force-dynamic';
export default async function TechnicianPage() {
  await requirePageRole('TECHNICIAN');
  return <TechnicianConsole />;
}
