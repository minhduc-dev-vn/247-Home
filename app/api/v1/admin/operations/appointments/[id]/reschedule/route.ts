import { getCurrentActor } from '@/shared/auth/server';
import {
  parseCuid,
  withOperationsJsonMutation,
} from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
import { rescheduleAppointment, rescheduleSchema } from '@/modules/operations';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withOperationsJsonMutation(
    request,
    rescheduleSchema,
    { rateLimitScope: 'operations-reschedule' },
    async (requestId, input) =>
      createSuccessResponse(
        await rescheduleAppointment(
          await getCurrentActor(),
          parseCuid((await context.params).id),
          input.slotId,
          input.expectedVersion,
          input.reason,
          requestId,
        ),
        requestId,
      ),
  );
}
