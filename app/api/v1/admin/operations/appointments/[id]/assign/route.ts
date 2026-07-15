import { assignTechnician, assignmentSchema } from '@/modules/operations';
import { getCurrentActor } from '@/shared/auth/server';
import {
  parseCuid,
  withOperationsJsonMutation,
} from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withOperationsJsonMutation(
    request,
    assignmentSchema,
    { rateLimitScope: 'operations-assign' },
    async (requestId, input) =>
      createSuccessResponse(
        await assignTechnician(
          await getCurrentActor(),
          parseCuid((await context.params).id),
          input.technicianId,
          input.expectedVersion,
          input.reason,
          requestId,
        ),
        requestId,
      ),
  );
}
