import { getCurrentActor } from '@/shared/auth/server';
import { parseSearchParams, withApiHandler } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
import {
  eligibleTechnicianQuerySchema,
  listAvailableTechnicians,
} from '@/modules/operations';
export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(
      await listAvailableTechnicians(
        await getCurrentActor(),
        parseSearchParams(request, eligibleTechnicianQuerySchema),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    ),
  );
}
