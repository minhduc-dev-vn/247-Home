import { TechnicianOrderDetail } from '@/components/operations/technician-console';
import { requirePageRole } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

export default async function TechnicianOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole('TECHNICIAN');
  return <TechnicianOrderDetail assignmentId={(await params).id} />;
}
