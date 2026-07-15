import {
  adminListQuerySchema,
  createProduct,
  listAdminProducts,
  productInputSchema,
  requireCatalogAccess,
} from '@/modules/catalog';
import { getCurrentActor } from '@/shared/auth/server';
import {
  parseSearchParams,
  withApiHandler,
  withJsonMutation,
} from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) => {
    requireCatalogAccess(await getCurrentActor());
    const query = parseSearchParams(request, adminListQuerySchema);
    return createSuccessResponse(
      await listAdminProducts(query.cursor, query.limit),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  });
}

export async function POST(request: Request) {
  return withJsonMutation(
    request,
    productInputSchema,
    { rateLimitScope: 'catalog-product' },
    async (requestId, input) =>
      createSuccessResponse(
        await createProduct(await getCurrentActor(), input),
        requestId,
        { status: 201 },
      ),
  );
}
