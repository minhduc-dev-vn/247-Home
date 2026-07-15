import { getOperationsOrder } from '@/modules/operations';
import { CatalogError } from '@/modules/catalog';
import { getCurrentActor } from '@/shared/auth/server';
import { parseCuid, withApiHandler } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(request, async (requestId) => {
    const order = await getOperationsOrder(
      await getCurrentActor(),
      parseCuid((await context.params).id),
    );
    if (!order) throw new CatalogError('NOT_FOUND');
    return createSuccessResponse(order, requestId, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  });
}
