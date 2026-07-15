import {
  deactivateServiceArea,
  serviceAreaPatchSchema,
  updateServiceArea,
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
    serviceAreaPatchSchema,
    { rateLimitScope: 'service-area-admin' },
    async (requestId, input) =>
      createSuccessResponse(
        await updateServiceArea(
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
    { rateLimitScope: 'service-area-admin' },
    async (requestId) => {
      await deactivateServiceArea(
        await getCurrentActor(),
        parseCuid((await context.params).id),
        requestId,
      );
      return createSuccessResponse({ deactivated: true }, requestId);
    },
  );
}
