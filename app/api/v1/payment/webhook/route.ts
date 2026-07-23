import { consumeRateLimit } from '@/modules/identity/infrastructure/rate-limiter';
import { processVnpayWebhook, type VnpayParameters } from '@/modules/payment';
import { trustedClientAddress } from '@/shared/http/client-address';
import { withApiHandler } from '@/shared/http/api-handler';
import { createErrorResponse } from '@/shared/http/response';

const maxWebhookBytes = 32 * 1024;

function clientKey(request: Request): string {
  return trustedClientAddress(request);
}

function vnpayResponse(rspCode: string, message: string, requestId: string) {
  return Response.json(
    { RspCode: rspCode, Message: message },
    {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Request-Id': requestId,
      },
    },
  );
}

function queryParameters(request: Request): VnpayParameters {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

async function postParameters(
  request: Request,
): Promise<VnpayParameters | null> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > maxWebhookBytes)
    return null;
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxWebhookBytes) return null;
  if (/^application\/x-www-form-urlencoded(?:\s*;|$)/.test(contentType))
    return Object.fromEntries(new URLSearchParams(raw).entries());
  if (/^application\/json(?:\s*;|$)/.test(contentType)) {
    try {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
      const entries = Object.entries(value);
      if (entries.some(([, item]) => typeof item !== 'string')) return null;
      return Object.fromEntries(entries) as VnpayParameters;
    } catch {
      return null;
    }
  }
  return null;
}

async function handle(request: Request, parameters: VnpayParameters | null) {
  return withApiHandler(request, async (requestId) => {
    const rateLimit = consumeRateLimit(
      'payment-webhook',
      `vnpay:${clientKey(request)}`,
    );
    if (!rateLimit.allowed)
      return createErrorResponse(
        'RATE_LIMITED',
        'Qua nhieu callback.',
        requestId,
        429,
        { headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    if (!parameters)
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Webhook payload khong hop le.',
        requestId,
        400,
      );
    const result = await processVnpayWebhook(parameters, requestId);
    return vnpayResponse(result.rspCode, result.message, requestId);
  });
}

// VNPay IPN v2.1 uses query parameters. POST is also accepted for providers or
// reverse proxies that deliver the same signed field set in a bounded body.
export async function GET(request: Request) {
  return handle(request, queryParameters(request));
}

export async function POST(request: Request) {
  return handle(request, await postParameters(request));
}
