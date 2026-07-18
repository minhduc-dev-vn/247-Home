import {
  addWarrantyEvidence,
  warrantyEvidenceSchema,
} from '@/modules/warranty';
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
    warrantyEvidenceSchema,
    {
      maxBodyBytes: 8 * 1024 * 1024,
      rateLimitScope: 'warranty-evidence',
    },
    async (requestId, input) =>
      createSuccessResponse(
        await addWarrantyEvidence(
          await getCurrentActor(),
          parseCuid((await context.params).id),
          input,
          requestId,
        ),
        requestId,
        { status: 201 },
      ),
  );
}
