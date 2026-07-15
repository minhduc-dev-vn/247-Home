import { getCart } from '@/modules/commerce';
import { getCurrentActor } from '@/shared/auth/server';
import { withApiHandler } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(await getCart(await getCurrentActor()), requestId, {
      headers: { 'Cache-Control': 'private, no-store' },
    }),
  );
}
