import { listWarranties, warrantyQuerySchema } from '@/modules/operations';
import { getCurrentActor } from '@/shared/auth/server';
import { parseSearchParams, withApiHandler } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(
      await listWarranties(
        await getCurrentActor(),
        parseSearchParams(request, warrantyQuerySchema),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    ),
  );
}
