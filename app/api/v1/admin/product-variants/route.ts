import { createVariant, variantInputSchema } from '@/modules/catalog';
import { getCurrentActor } from '@/shared/auth/server';
import { withJsonMutation } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function POST(request: Request) {
  return withJsonMutation(
    request,
    variantInputSchema,
    { rateLimitScope: 'catalog-variant' },
    async (requestId, input) =>
      createSuccessResponse(
        await createVariant(await getCurrentActor(), input, requestId),
        requestId,
        { status: 201 },
      ),
  );
}
