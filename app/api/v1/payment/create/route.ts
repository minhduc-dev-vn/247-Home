import {
  createOnlinePaymentSession,
  paymentCreateSchema,
} from '@/modules/payment';
import { getCurrentActor } from '@/shared/auth/server';
import { withJsonMutation } from '@/shared/http/api-handler';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/shared/http/response';

const keyPattern = /^[A-Za-z0-9_-]{16,128}$/;

function clientIp(request: Request): string {
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return '127.0.0.1';
  return (
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

export async function POST(request: Request) {
  return withJsonMutation(
    request,
    paymentCreateSchema,
    {
      maxBodyBytes: 8 * 1024,
      rateLimitScope: 'payment-create',
      rateLimitAction: 'sensitive-mutation',
    },
    async (requestId, input) => {
      const idempotencyKey = request.headers.get('idempotency-key');
      if (!idempotencyKey || !keyPattern.test(idempotencyKey))
        return createErrorResponse(
          'VALIDATION_ERROR',
          'Idempotency-Key khong hop le.',
          requestId,
          400,
        );
      const result = await createOnlinePaymentSession(
        await getCurrentActor(),
        input,
        idempotencyKey,
        clientIp(request),
        requestId,
      );
      return createSuccessResponse(result.payment, requestId, {
        status: result.replayed ? 200 : 201,
        headers: result.replayed
          ? { 'Idempotent-Replayed': 'true' }
          : undefined,
      });
    },
  );
}
