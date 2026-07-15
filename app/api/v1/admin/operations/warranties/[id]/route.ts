import { getOperationsWarranty } from '@/modules/operations';
import { CatalogError } from '@/modules/catalog';
import { getCurrentActor } from '@/shared/auth/server';
import { parseCuid, withApiHandler } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(request, async (requestId) => {
    const warranty = await getOperationsWarranty(
      await getCurrentActor(),
      parseCuid((await context.params).id),
    );
    if (!warranty) throw new CatalogError('NOT_FOUND');
    return createSuccessResponse(warranty, requestId, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  });
}
