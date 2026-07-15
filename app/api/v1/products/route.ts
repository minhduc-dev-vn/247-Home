import { listPublicProducts, productListQuerySchema } from '@/modules/catalog';
import { withApiHandler, parseSearchParams } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) => {
    const query = parseSearchParams(request, productListQuerySchema);
    return createSuccessResponse(await listPublicProducts(query), requestId, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    });
  });
}
