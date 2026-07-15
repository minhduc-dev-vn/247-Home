import { adjustInventory, inventoryAdjustmentSchema } from '@/modules/catalog';
import { getCurrentActor } from '@/shared/auth/server';
import { parseCuid, withJsonMutation } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function POST(
  request: Request,
  context: { params: Promise<{ variantId: string }> },
) {
  return withJsonMutation(
    request,
    inventoryAdjustmentSchema,
    { rateLimitScope: 'inventory-adjustment' },
    async (requestId, input) => {
      const { variantId: rawVariantId } = await context.params;
      const variantId = parseCuid(rawVariantId);
      return createSuccessResponse(
        await adjustInventory(
          await getCurrentActor(),
          variantId,
          input,
          requestId,
        ),
        requestId,
      );
    },
  );
}
