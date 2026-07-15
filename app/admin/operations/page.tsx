import { OperationsConsole } from '@/components/operations/operations-console';
import { requirePageRole } from '@/shared/auth/server';
export const dynamic = 'force-dynamic';
export default async function OperationsPage() {
  const actor = await requirePageRole('STAFF', 'MANAGER', 'ADMIN');
  return <OperationsConsole roles={actor.roles} />;
}
