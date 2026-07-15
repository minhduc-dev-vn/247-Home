import {
  checkout,
  checkoutInputSchema,
  listOrders,
  orderListQuerySchema,
} from '@/modules/commerce';
import { getCurrentActor } from '@/shared/auth/server';
import {
  parseSearchParams,
  withApiHandler,
  withJsonMutation,
} from '@/shared/http/api-handler';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/shared/http/response';
const keyPattern = /^[A-Za-z0-9_-]{16,128}$/;
export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(
      await listOrders(
        await getCurrentActor(),
        parseSearchParams(request, orderListQuerySchema),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    ),
  );
}
export async function POST(request: Request) {
  return withJsonMutation(
    request,
    checkoutInputSchema,
    { rateLimitScope: 'checkout' },
    async (requestId, input) => {
      const key = request.headers.get('idempotency-key');
      if (!key || !keyPattern.test(key))
        return createErrorResponse(
          'VALIDATION_ERROR',
          'Idempotency-Key khong hop le.',
          requestId,
          400,
        );
      const result = await checkout(
        await getCurrentActor(),
        input,
        key,
        requestId,
      );
      return createSuccessResponse(
        {
          id: result.order.id,
          orderNumber: result.order.orderNumber,
          status: result.order.status,
          grandTotal: result.order.grandTotal.toString(),
          currency: result.order.currency,
          version: result.order.version,
          payment: {
            method: result.order.payment?.method,
            status: result.order.payment?.status,
            amount: result.order.payment?.amount.toString(),
            referenceCode: result.order.payment?.referenceCode,
          },
        },
        requestId,
        {
          status: result.replayed ? 200 : 201,
          headers: result.replayed
            ? { 'Idempotent-Replayed': 'true' }
            : undefined,
        },
      );
    },
  );
}
