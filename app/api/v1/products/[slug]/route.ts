import { getPublicProduct } from '@/modules/catalog';
import { withApiHandler } from '@/shared/http/api-handler';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/shared/http/response';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return withApiHandler(request, async (requestId) => {
    const { slug } = await context.params;
    const product = await getPublicProduct(slug);
    return product
      ? createSuccessResponse(product, requestId, {
          headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
        })
      : createErrorResponse(
          'NOT_FOUND',
          'Không tìm thấy sản phẩm.',
          requestId,
          404,
        );
  });
}
