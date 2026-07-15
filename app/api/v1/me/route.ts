import { getCurrentActor } from '@/shared/auth/server';
import {
  createErrorResponse,
  createSuccessResponse,
  getRequestId,
} from '@/shared/http/response';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
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
}
