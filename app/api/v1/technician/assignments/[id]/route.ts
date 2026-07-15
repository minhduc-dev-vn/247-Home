import { getTechnicianAssignment } from '@/modules/operations';
import { getCurrentActor } from '@/shared/auth/server';
import { parseCuid, withApiHandler } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(
      await getTechnicianAssignment(
        await getCurrentActor(),
        parseCuid((await context.params).id),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    ),
  );
}
