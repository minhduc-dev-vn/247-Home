import { getCurrentActor } from '@/shared/auth/server';
import { withApiHandler } from '@/shared/http/api-handler';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/shared/http/response';

export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) => {
    const actor = await getCurrentActor();

    if (!actor) {
      return createErrorResponse(
        'UNAUTHENTICATED',
        'Cần đăng nhập.',
        requestId,
        401,
      );
    }

    return createSuccessResponse(actor, requestId, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  });
}
