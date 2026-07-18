import { listWarrantyAudit, warrantyAuditListSchema } from '@/modules/warranty';
import { getCurrentActor } from '@/shared/auth/server';
import {
  parseCuid,
  parseSearchParams,
  withApiHandler,
} from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(
      await listWarrantyAudit(
        await getCurrentActor(),
        parseCuid((await context.params).id),
        parseSearchParams(request, warrantyAuditListSchema),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    ),
  );
}
