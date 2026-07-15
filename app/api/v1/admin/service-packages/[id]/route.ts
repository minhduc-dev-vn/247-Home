import {
  deactivateServicePackage,
  servicePackagePatchSchema,
  updateServicePackage,
} from '@/modules/catalog';
import { getCurrentActor } from '@/shared/auth/server';
import {
  parseCuid,
  withJsonMutation,
  withMutation,
} from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withJsonMutation(
    request,
    servicePackagePatchSchema,
    { rateLimitScope: 'catalog-service-package' },
    async (requestId, input) =>
      createSuccessResponse(
        await updateServicePackage(
          await getCurrentActor(),
          parseCuid((await context.params).id),
          input,
          requestId,
        ),
        requestId,
      ),
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMutation(
    request,
    { rateLimitScope: 'catalog-service-package' },
    async (requestId) => {
      await deactivateServicePackage(
        await getCurrentActor(),
        parseCuid((await context.params).id),
        requestId,
      );
      return createSuccessResponse({ deactivated: true }, requestId);
    },
  );
}
