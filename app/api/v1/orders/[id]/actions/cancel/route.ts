import { customerOrderCancelSchema, transitionOrder } from '@/modules/commerce';
import { getCurrentActor } from '@/shared/auth/server';
import { parseCuid, withJsonMutation } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withJsonMutation(
    request,
    customerOrderCancelSchema,
    { rateLimitScope: 'customer-order-cancel' },
    async (requestId, input) =>
      createSuccessResponse(
        await transitionOrder(
          await getCurrentActor(),
          parseCuid((await context.params).id),
          'cancel',
          input.expectedVersion,
          input.reason,
          requestId,
        ),
        requestId,
      ),
  );
}
