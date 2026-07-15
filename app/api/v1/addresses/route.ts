import {
  addressInputSchema,
  addressListQuerySchema,
  createAddress,
  listAddresses,
} from '@/modules/commerce';
import { getCurrentActor } from '@/shared/auth/server';
import {
  parseSearchParams,
  withApiHandler,
  withJsonMutation,
} from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(
      await listAddresses(
        await getCurrentActor(),
        parseSearchParams(request, addressListQuerySchema),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    ),
  );
}
export async function POST(request: Request) {
  return withJsonMutation(
    request,
    addressInputSchema,
    { rateLimitScope: 'address' },
    async (requestId, input) =>
      createSuccessResponse(
        await createAddress(await getCurrentActor(), input),
        requestId,
        { status: 201 },
      ),
  );
}
