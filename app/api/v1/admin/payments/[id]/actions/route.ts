import {
  getAvailablePaymentActions,
  paymentActionSchema,
  transitionPayment,
} from '@/modules/commerce';
import { getCurrentActor } from '@/shared/auth/server';
import {
  parseCuid,
  withApiHandler,
  withOperationsJsonMutation,
} from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(
      await getAvailablePaymentActions(
        await getCurrentActor(),
        parseCuid((await context.params).id),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    ),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withOperationsJsonMutation(
    request,
    paymentActionSchema,
    { rateLimitScope: 'payment-action' },
    async (requestId, input) =>
      createSuccessResponse(
        await transitionPayment(
          await getCurrentActor(),
          parseCuid((await context.params).id),
          input.action,
          input.expectedVersion,
          input.reason,
          input.reference,
          requestId,
        ),
        requestId,
      ),
  );
}
