import { listSlots, slotQuerySchema } from '@/modules/commerce';
import { parseSearchParams, withApiHandler } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) => {
    const query = parseSearchParams(request, slotQuerySchema);
    return createSuccessResponse(await listSlots(query), requestId);
  });
}
