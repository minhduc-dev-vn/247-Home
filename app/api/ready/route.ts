import { databaseIsReachable } from '@/shared/db/readiness';
import {
  createErrorResponse,
  createSuccessResponse,
  getRequestId,
} from '@/shared/http/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const isReady = await databaseIsReachable();

  if (!isReady) {
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Dịch vụ chưa sẵn sàng.',
      requestId,
      503,
    );
  }

  return createSuccessResponse({ status: 'ready' }, requestId, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
