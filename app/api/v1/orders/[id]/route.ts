import { getOrder } from '@/modules/commerce';
import { getCurrentActor } from '@/shared/auth/server';
import { parseCuid, withApiHandler } from '@/shared/http/api-handler';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/shared/http/response';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(request, async (requestId) => {
    const order = await getOrder(
      await getCurrentActor(),
      parseCuid((await context.params).id),
    );
    return order
      ? createSuccessResponse(order, requestId, {
          headers: { 'Cache-Control': 'private, no-store' },
        })
      : createErrorResponse(
          'NOT_FOUND',
          'Khong tim thay don hang.',
          requestId,
          404,
        );
  });
}
