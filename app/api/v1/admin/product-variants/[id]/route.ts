import {
  deactivateVariant,
  updateVariant,
  variantPatchSchema,
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
    variantPatchSchema,
    { rateLimitScope: 'catalog-variant' },
    async (requestId, input) =>
      createSuccessResponse(
        await updateVariant(
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
    { rateLimitScope: 'catalog-variant' },
    async (requestId) => {
      await deactivateVariant(
        await getCurrentActor(),
        parseCuid((await context.params).id),
        requestId,
      );
      return createSuccessResponse({ deactivated: true }, requestId);
    },
  );
}
