import {
  cartItemPatchSchema,
  removeCartItem,
  updateCartItem,
} from '@/modules/commerce';
import { getCurrentActor } from '@/shared/auth/server';
import {
  parseCuid,
  withApiHandler,
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
    cartItemPatchSchema,
    { rateLimitScope: 'cart-item' },
    async (requestId, input) => {
      const id = parseCuid((await context.params).id);
      return createSuccessResponse(
        await updateCartItem(await getCurrentActor(), id, input.quantity),
        requestId,
      );
    },
  );
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMutation(
    request,
    { rateLimitScope: 'cart-item' },
    async (requestId) =>
      createSuccessResponse(
        await removeCartItem(
          await getCurrentActor(),
          parseCuid((await context.params).id),
        ),
        requestId,
      ),
  );
}
