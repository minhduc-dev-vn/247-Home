import {
  authorizeOrderActor,
  getAvailableOrderActions,
  orderActionSchema,
  transitionOrder,
} from '@/modules/commerce';
import { CatalogError } from '@/modules/catalog';
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
    orderActionSchema,
    { rateLimitScope: 'operations-order-action' },
    async (requestId, input) => {
      const actor = await getCurrentActor();
      const authorization = authorizeOrderActor(actor);
      if (!authorization.allowed) throw new CatalogError(authorization.code);
      return createSuccessResponse(
        await transitionOrder(
          actor,
          parseCuid((await context.params).id),
          input.action,
          input.expectedVersion,
          input.reason,
          requestId,
        ),
        requestId,
      );
    },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(
      await getAvailableOrderActions(
        await getCurrentActor(),
        parseCuid((await context.params).id),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    ),
  );
}
