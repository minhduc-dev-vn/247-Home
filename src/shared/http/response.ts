type ErrorCode =
  | 'CART_EMPTY'
  | 'CONFLICT'
  | 'CONCURRENT_MODIFICATION'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVENTORY_CONFLICT'
  | 'INVENTORY_INSUFFICIENT'
  | 'INVALID_STATE_TRANSITION'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'SERVICE_AREA_UNSUPPORTED'
  | 'SLOT_UNAVAILABLE'
  | 'STORAGE_UNAVAILABLE'
  | 'UNAUTHENTICATED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_ERROR';

type ResponseInitWithHeaders = ResponseInit & { headers?: HeadersInit };

function responseHeaders(
  requestId: string,
  init: ResponseInitWithHeaders = {},
): Headers {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('X-Request-Id', requestId);
  return headers;
}

export function getRequestId(request: Request): string {
  const incomingRequestId = request.headers.get('x-request-id');

  if (incomingRequestId && /^[A-Za-z0-9_-]{1,128}$/.test(incomingRequestId)) {
    return incomingRequestId;
  }

  return `req_${crypto.randomUUID()}`;
}

export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  init: ResponseInitWithHeaders = {},
): Response {
  return new Response(
    JSON.stringify({ data, meta: { requestId } }, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
    { ...init, headers: responseHeaders(requestId, init) },
  );
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  requestId: string,
  status: number,
  init: ResponseInitWithHeaders = {},
): Response {
  return Response.json(
    { error: { code, message, fieldErrors: {}, details: {}, requestId } },
    {
      ...init,
      headers: responseHeaders(requestId, {
        ...init,
        headers: { 'Cache-Control': 'private, no-store', ...init.headers },
      }),
      status,
    },
  );
}
