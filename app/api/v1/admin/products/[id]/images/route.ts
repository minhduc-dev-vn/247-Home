import {
  addProductImage,
  productImageInputSchema,
  requireCatalogAccess,
} from '@/modules/catalog';
import {
  removeLocalProductImage,
  saveLocalProductImage,
} from '@/modules/catalog/infrastructure/local-image-storage';
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
      const stored = await saveLocalProductImage(input);
      try {
        const image = await addProductImage(actor, productId, {
          storageKey: stored.storageKey,
          altText: input.altText,
          mimeType: input.contentType,
          byteSize: stored.byteSize,
        });
        return createSuccessResponse(image, requestId, { status: 201 });
      } catch (error: unknown) {
        try {
          await removeLocalProductImage(stored.storageKey);
        } catch (cleanupError: unknown) {
          throw new AggregateError(
            [error, cleanupError],
            'Product image persistence and cleanup both failed.',
          );
        }
        throw error;
      }
    },
  );
}
