import {
  addProductImage,
  productImageInputSchema,
  requireCatalogAccess,
} from '@/modules/catalog';
import { uploadAndPersistProductImage } from '@/modules/catalog/infrastructure/product-image-storage';
import { getCurrentActor } from '@/shared/auth/server';
import { parseCuid, withJsonMutation } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withJsonMutation(
    request,
    productImageInputSchema,
    { maxBodyBytes: 8 * 1024 * 1024, rateLimitScope: 'catalog-image' },
    async (requestId, input) => {
      const actor = await getCurrentActor();
      requireCatalogAccess(actor);
      const productId = parseCuid((await context.params).id);
      const image = await uploadAndPersistProductImage(input, (stored) =>
        addProductImage(
          actor,
          productId,
          {
            storageKey: stored.storageKey,
            altText: input.altText,
            mimeType: stored.contentType,
            byteSize: stored.byteSize,
          },
          requestId,
        ),
      );
      return createSuccessResponse(image, requestId, { status: 201 });
    },
  );
}
