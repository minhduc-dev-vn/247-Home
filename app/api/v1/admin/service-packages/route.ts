import {
  createServicePackage,
  servicePackageInputSchema,
} from '@/modules/catalog';
import { getCurrentActor } from '@/shared/auth/server';
import { withJsonMutation } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function POST(request: Request) {
  return withJsonMutation(
    request,
    servicePackageInputSchema,
    { rateLimitScope: 'catalog-service-package' },
    async (requestId, input) =>
      createSuccessResponse(
        await createServicePackage(await getCurrentActor(), input, requestId),
        requestId,
        { status: 201 },
      ),
  );
}
