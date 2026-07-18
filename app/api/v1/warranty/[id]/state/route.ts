import {
  transitionWarrantyRequest,
  warrantyStateSchema,
} from '@/modules/warranty';
import { getCurrentActor } from '@/shared/auth/server';
import {
  parseCuid,
  withOperationsJsonMutation,
} from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withOperationsJsonMutation(
    request,
    warrantyStateSchema,
    { rateLimitScope: 'warranty-state' },
    async (requestId, input) =>
      createSuccessResponse(
        await transitionWarrantyRequest(
          await getCurrentActor(),
          parseCuid((await context.params).id),
          input,
          requestId,
        ),
        requestId,
      ),
  );
}
