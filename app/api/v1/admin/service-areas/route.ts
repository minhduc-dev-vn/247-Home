import {
  createServiceArea,
  listServiceAreas,
  requireCatalogAccess,
  serviceAreaInputSchema,
  serviceAreaListQuerySchema,
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
    return createSuccessResponse(
      await listServiceAreas(
        true,
        parseSearchParams(request, serviceAreaListQuerySchema),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  });
}

export async function POST(request: Request) {
  return withJsonMutation(
    request,
    serviceAreaInputSchema,
    { rateLimitScope: 'service-area-admin' },
    async (requestId, input) => {
      return createSuccessResponse(
        await createServiceArea(await getCurrentActor(), input, requestId),
        requestId,
        { status: 201 },
      );
    },
  );
}
