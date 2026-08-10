import { databaseIsReachable } from '@/shared/db/readiness';
import { withApiHandler } from '@/shared/http/api-handler';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/shared/http/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) => {
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
  });
}
