import { addCartItem, cartItemInputSchema } from '@/modules/commerce';
import { getCurrentActor } from '@/shared/auth/server';
import { withJsonMutation } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
export async function POST(request: Request) {
  return withJsonMutation(
    request,
    cartItemInputSchema,
    { rateLimitScope: 'cart-item' },
    async (requestId, input) =>
      createSuccessResponse(
        await addCartItem(await getCurrentActor(), input),
        requestId,
        { status: 201 },
      ),
  );
}
