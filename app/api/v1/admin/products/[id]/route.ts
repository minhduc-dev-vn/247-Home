import {
  archiveProduct,
  productPatchSchema,
  updateProduct,
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
    productPatchSchema,
    { rateLimitScope: 'catalog-product' },
    async (requestId, input) =>
      createSuccessResponse(
        await updateProduct(
          await getCurrentActor(),
          parseCuid((await context.params).id),
          input,
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
    { rateLimitScope: 'catalog-product' },
    async (requestId) => {
      await archiveProduct(
        await getCurrentActor(),
        parseCuid((await context.params).id),
      );
      return createSuccessResponse({ archived: true }, requestId);
    },
  );
}
