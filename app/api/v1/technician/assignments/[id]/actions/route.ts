import {
  getTechnicianActionOptions,
  technicianAction,
  technicianActionSchema,
} from '@/modules/operations';
import { getCurrentActor } from '@/shared/auth/server';
import {
  parseCuid,
  withApiHandler,
  withOperationsJsonMutation,
} from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withOperationsJsonMutation(
    request,
    technicianActionSchema,
    { rateLimitScope: 'technician-action' },
    async (requestId, input) =>
      createSuccessResponse(
        await technicianAction(
          await getCurrentActor(),
          parseCuid((await context.params).id),
          input.action,
          input.expectedVersion,
          input.note,
          requestId,
        ),
        requestId,
      ),
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(
      await getTechnicianActionOptions(
        await getCurrentActor(),
        parseCuid((await context.params).id),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    ),
  );
}
