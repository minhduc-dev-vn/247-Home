import { quoteCart, quoteInputSchema } from '@/modules/commerce';
import { getCurrentActor } from '@/shared/auth/server';
import { withJsonMutation } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
export async function POST(request: Request) {
  return withJsonMutation(
    request,
    quoteInputSchema,
    { rateLimitScope: 'cart-quote' },
    async (requestId, input) =>
      createSuccessResponse(
        await quoteCart(await getCurrentActor(), input),
        requestId,
        { headers: { 'Cache-Control': 'private, no-store' } },
      ),
  );
}
