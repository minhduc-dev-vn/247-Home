import {
  createWarrantyRequest,
  listWarrantyRequests,
  warrantyCreateSchema,
  warrantyListSchema,
} from '@/modules/warranty';
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

const idempotencyKeyPattern = /^[A-Za-z0-9_-]{16,128}$/;

export async function GET(request: Request) {
  return withApiHandler(request, async (requestId) =>
    createSuccessResponse(
      await listWarrantyRequests(
        await getCurrentActor(),
        parseSearchParams(request, warrantyListSchema),
      ),
      requestId,
      { headers: { 'Cache-Control': 'private, no-store' } },
    ),
  );
}

export async function POST(request: Request) {
  return withJsonMutation(
    request,
    warrantyCreateSchema,
    { rateLimitScope: 'warranty-create' },
    async (requestId, input) => {
      const idempotencyKey = request.headers.get('idempotency-key');
      if (!idempotencyKey || !idempotencyKeyPattern.test(idempotencyKey)) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          'Idempotency-Key khong hop le.',
          requestId,
          400,
        );
      }
      const result = await createWarrantyRequest(
        await getCurrentActor(),
        input,
        requestId,
        idempotencyKey,
      );
      const { replayed, ...warranty } = result;
      return createSuccessResponse(warranty, requestId, {
        status: replayed ? 200 : 201,
        headers: replayed ? { 'Idempotent-Replayed': 'true' } : undefined,
      });
    },
  );
}
